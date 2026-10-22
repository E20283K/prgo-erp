"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { DepartmentRecord } from "../types";
import {
  DocumentHeader,
  DocumentSidebar,
  DocumentNavItem,
  SidebarSummaryCard,
  InfoRow,
} from "../../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Users,
  Briefcase,
  Save,
  Printer,
  CheckCircle2,
  Phone,
  Layers,
} from "lucide-react";

interface DepartmentDetailProps {
  tab: DocumentTab;
}

export function DepartmentDetail({ tab }: DepartmentDetailProps) {
  const { departmentsList, upsertDepartment, employees, openTab, setTabUnsaved, updateTabData, closeTab, addNotification } =
    useWorkspaceStore();

  const deptId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("dept-")) return tab.id.replace("dept-", "");
    return tab.id;
  }, [tab]);

  const initialDept: DepartmentRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.name) {
      return tab.documentData;
    }
    const found = departmentsList.find((d) => d.id === deptId || d.code === deptId);
    return (
      found || {
        id: deptId,
        code: "DEP-NEW",
        name: tab.title || "Yangi bo'lim",
        description: "",
        headPerson: "",
        phone: "",
        staffCount: 0,
        plant: "PrintGoo Bosh Zavod",
        isActive: true,
      }
    );
  }, [tab.documentData, departmentsList, deptId]);

  const [formData, setFormData] = useState<DepartmentRecord>(initialDept);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSaved, setIsSaved] = useState(false);

  // Department employees
  const deptEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.departmentName === formData.name ||
        e.department === formData.name ||
        e.departmentId === formData.id
    );
  }, [employees, formData]);

  const handleUpdate = (updated: Partial<DepartmentRecord>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      if (formData.id && formData.id.length > 20) {
        await fetch("/api/v1/hr/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
    } catch {}

    upsertDepartment(formData);
    updateTabData(tab.id, formData);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);
    addNotification({
      title: "Bo'lim ma'lumotlari saqlandi",
      description: `${formData.name} yangilandi.`,
      severity: "success",
    });
    setTimeout(() => setIsSaved(false), 2500);
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Sex pasporti", icon: Building2 },
    {
      id: "staff",
      label: "Bo'lim xodimlari",
      icon: Users,
      badge: String(deptEmployees.length),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      <DocumentHeader
        icon={Building2}
        title={formData.name}
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
            <SidebarSummaryCard icon={Building2} title={formData.name} subtitle={formData.code}>
              <InfoRow label="Sex boshlig'i">{formData.headPerson || "Biriktirilmagan"}</InfoRow>
              <InfoRow label="Telefon">{formData.phone || "—"}</InfoRow>
              <InfoRow label="Filial">{formData.plant || "Bosh Zavod"}</InfoRow>
              <InfoRow label="Xodimlar shtati">
                <span className="font-mono font-medium">{deptEmployees.length} kishi</span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Bo'lim ma'lumotlari"
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
                    <Building2 className="size-4 text-primary" />
                    Sex / Bo'lim Rekvizitlari
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tashkiliy struktura va ishlab chiqarish sexi parametrlari
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Sex kodi *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => handleUpdate({ code: e.target.value })}
                      className="h-8 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Sex / Bo'lim nomi *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleUpdate({ name: e.target.value })}
                      className="h-8 font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Sex boshlig'i (Master)</Label>
                    <Input
                      value={formData.headPerson || ""}
                      onChange={(e) => handleUpdate({ headPerson: e.target.value })}
                      className="h-8"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Aloqa telefoni</Label>
                    <Input
                      value={formData.phone || ""}
                      onChange={(e) => handleUpdate({ phone: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Izoh va texnologik tavsif</Label>
                    <Input
                      value={formData.description || ""}
                      onChange={(e) => handleUpdate({ description: e.target.value })}
                      className="h-8"
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
                    Bo'limga biriktirilgan xodimlar ({deptEmployees.length} ta)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sexda ishlovchi barcha pechatnik, operator va mutaxassislar ro'yxati
                  </p>
                </div>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Tabel №</th>
                      <th className="px-3 py-1">Xodim F.I.O.</th>
                      <th className="px-3 py-1">Lavozim</th>
                      <th className="px-3 py-1">To'lov shakli</th>
                      <th className="px-3 py-1">Smena</th>
                      <th className="px-3 py-1">Telefon</th>
                      <th className="px-3 py-1">Holati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          Ushbu sexda hozircha xodimlar qayd etilmagan.
                        </td>
                      </tr>
                    ) : (
                      deptEmployees.map((e) => (
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
                          <td className="px-3 py-1">{e.positionTitle || e.position}</td>
                          <td className="px-3 py-1">{e.wageType}</td>
                          <td className="px-3 py-1 text-muted-foreground">{e.currentShift}</td>
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
