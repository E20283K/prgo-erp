"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { PositionRecord } from "../types";
import {
  DocumentHeader,
  DocumentSidebar,
  DocumentNavItem,
  SidebarSummaryCard,
  InfoRow,
} from "../../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxSelect, type ComboboxOption } from "@/components/ui/combobox";
import { generateNextCode } from "@/lib/utils";
import { Briefcase, Users, CreditCard, Save, Printer, CheckCircle2 } from "lucide-react";

interface PositionDetailProps {
  tab: DocumentTab;
}

export function PositionDetail({ tab }: PositionDetailProps) {
  const {
    positionsList,
    upsertPosition,
    employees,
    openTab,
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
    departmentsList,
    setDepartmentsList,
  } = useWorkspaceStore();

  useEffect(() => {
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
  }, [departmentsList.length, setDepartmentsList]);

  const posId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("pos-")) return tab.id.replace("pos-", "");
    return tab.id;
  }, [tab]);

  const initialPos: PositionRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.title) {
      return tab.documentData;
    }
    const found = positionsList.find((p) => p.id === posId || p.code === posId);
    const nextCode = generateNextCode("POS", positionsList.map((p) => p.code), 2);
    return (
      found || {
        id: posId,
        code: nextCode,
        title: tab.title || "Yangi lavozim",
        departmentName: "",
        defaultWageType: "piecework",
        standardRate: 0,
        currency: "UZS",
        isActive: true,
        employeesCount: 0,
      }
    );
  }, [tab.documentData, positionsList, posId]);

  const [formData, setFormData] = useState<PositionRecord>(initialPos);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSaved, setIsSaved] = useState(false);

  const departmentOptions = useMemo<ComboboxOption[]>(() => {
    return departmentsList.map((d) => ({
      value: d.name,
      label: d.name,
      description: d.code ? `Kodi: ${d.code}` : undefined,
    }));
  }, [departmentsList]);

  // Position employees
  const positionEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.positionTitle === formData.title ||
        e.position === formData.title ||
        e.positionId === formData.id
    );
  }, [employees, formData]);

  const handleUpdate = (updated: Partial<PositionRecord>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      if (formData.id && formData.id.length > 20) {
        await fetch("/api/v1/hr/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
    } catch {}

    upsertPosition(formData);
    updateTabData(tab.id, formData);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);
    addNotification({
      title: "Lavozim ma'lumotlari saqlandi",
      description: `${formData.title} yangilandi.`,
      severity: "success",
    });
    setTimeout(() => setIsSaved(false), 2500);
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Lavozim tarifi", icon: Briefcase },
    {
      id: "staff",
      label: "Band xodimlar",
      icon: Users,
      badge: String(positionEmployees.length),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      <DocumentHeader
        icon={Briefcase}
        title={formData.title}
        docNo={formData.code}
        status={formData.isActive ? "active" : "terminated"}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Chop etish
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
              <Save className="size-3.5" />
              {isSaved ? "Saqlandi" : "Saqlash"}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-primary text-primary-foreground gap-1"
              onClick={() => {
                handleSave();
                closeTab(tab.id);
              }}
            >
              <CheckCircle2 className="size-3.5" />
              O'tkazish va yopish
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          summary={
            <SidebarSummaryCard icon={Briefcase} title={formData.title} subtitle={formData.code}>
              <InfoRow label="Sex / Bo'lim">{formData.departmentName || "—"}</InfoRow>
              <InfoRow label="To'lov shakli">{formData.defaultWageType}</InfoRow>
              <InfoRow label="Standart oklad">
                <span className="font-mono font-medium">
                  {formData.standardRate.toLocaleString("uz-UZ")} UZS
                </span>
              </InfoRow>
              <InfoRow label="Band shtatlar">
                <span className="font-mono font-medium">{positionEmployees.length} xodim</span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Lavozim bo'limlari"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4 max-w-3xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="size-4 text-primary" />
                    Shtat Birligi va Tarif Parametrlari
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kadrlar lavozimlar klassifikatori va to'lov shartlari
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Lavozim kodi *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => handleUpdate({ code: e.target.value })}
                      className="h-8 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Lavozim nomi *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => handleUpdate({ title: e.target.value })}
                      className="h-8 font-medium"
                    />
                  </div>

                  <div className="min-w-0">
                    <Label className="text-xs">Biriktirilgan sex / bo&apos;lim</Label>
                    <ComboboxSelect
                      items={departmentOptions}
                      value={formData.departmentName || ""}
                      onValueChange={(val) => {
                        const dept = departmentsList.find((d) => d.name === val || d.id === val);
                        handleUpdate({
                          departmentName: val,
                          departmentId: dept?.id || formData.departmentId,
                        });
                      }}
                      placeholder="Bo'limni tanlang..."
                      className="h-8 text-xs w-full font-medium"
                      contentClassName="w-[300px]"
                      actionLabel="Yangi bo'lim yaratish..."
                      onAction={(query) => {
                        openTab({
                          id: `dept-new-${Date.now()}`,
                          title: query?.trim() || "Yangi bo'lim",
                          type: "department-detail",
                          module: "hr",
                          documentData: { name: query?.trim() || "", isNew: true },
                        });
                      }}
                      renderItem={(dept) => (
                        <div className="flex items-center justify-between w-full min-w-0 pr-1 py-0.5">
                          <span className="text-xs font-medium text-foreground truncate">{dept.label}</span>
                          {dept.description && (
                            <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">
                              {dept.description}
                            </span>
                          )}
                        </div>
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">To'lov shakli</Label>
                    <Select
                      value={formData.defaultWageType}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ defaultWageType: val as any });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piecework">Ishbay (Sdelka)</SelectItem>
                        <SelectItem value="mixed">Aralash (Oklad + Sdelka)</SelectItem>
                        <SelectItem value="salary">Oklad (Sobit)</SelectItem>
                        <SelectItem value="hourly">Soatbay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Standart tarif / stavka (UZS)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={0}
                      value={formData.standardRate}
                      onValueChange={(values) => handleUpdate({ standardRate: values.floatValue ?? 0 })}
                      className="h-8 font-mono font-medium"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    Ushbu lavozimda ishlovchi xodimlar ({positionEmployees.length} ta)
                  </h3>
                </div>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Tabel №</th>
                      <th className="px-3 py-1">Xodim F.I.O.</th>
                      <th className="px-3 py-1">Sex</th>
                      <th className="px-3 py-1">Oklad</th>
                      <th className="px-3 py-1">Telefon</th>
                      <th className="px-3 py-1">Holati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Ushbu lavozimga xodimlar biriktirilmagan.
                        </td>
                      </tr>
                    ) : (
                      positionEmployees.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b hover:bg-muted/30 h-7 cursor-pointer"
                          onClick={() =>
                            openTab({
                              id: `emp-${e.id}`,
                              title: `${e.fullName} (${e.badgeNumber || e.badgeNo})`,
                              type: "employee-detail",
                              module: "hr",
                              documentData: e,
                            })
                          }
                        >
                          <td className="px-3 py-1 font-mono font-semibold text-primary">
                            {e.badgeNumber || e.badgeNo}
                          </td>
                          <td className="px-3 py-1 font-medium">{e.fullName}</td>
                          <td className="px-3 py-1 text-muted-foreground">{e.departmentName || e.department}</td>
                          <td className="px-3 py-1 font-mono">{e.baseSalary.toLocaleString("uz-UZ")} UZS</td>
                          <td className="px-3 py-1 font-mono">{e.phone}</td>
                          <td className="px-3 py-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4.5 px-1.5 ${
                                e.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-300"
                              }`}
                            >
                              {e.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
