"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { DepartmentRecord, EmployeeRecord } from "../types";
import {
  DocumentHeader,
  DocumentSidebar,
  DocumentNavItem,
  SidebarSummaryCard,
  InfoRow,
} from "../../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import {
  Building2,
  Users,
  Save,
  Printer,
  CheckCircle2,
  ExternalLink,
  Search,
  Plus,
} from "lucide-react";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { generateNextCode } from "@/lib/utils";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface DepartmentDetailProps {
  tab: DocumentTab;
}

export function DepartmentDetail({ tab }: DepartmentDetailProps) {
  const {
    departmentsList,
    upsertDepartment,
    employees,
    setEmployees,
    plants,
    fetchPlants,
    openTab,
    setTabUnsaved,
    updateTabData,
    replaceTabId,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const deptId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("dept-")) return tab.id.replace("dept-", "");
    return tab.id;
  }, [tab]);

  const initialDept: DepartmentRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.name !== undefined) {
      return tab.documentData as DepartmentRecord;
    }
    const found = departmentsList.find((d) => d.id === deptId || d.code === deptId);
    const nextCode = generateNextCode("DEP", departmentsList.map((d) => d.code), 2);
    return (
      found || {
        id: deptId,
        code: nextCode,
        name: tab.title && !tab.title.startsWith("Yangi sex") ? tab.title : "",
        description: "",
        headPerson: "",
        phone: "",
        staffCount: 0,
        plant: "PrintGoo Bosh Zavod",
        isActive: true,
      }
    );
  }, [tab.documentData, tab.title, departmentsList, deptId]);

  const [formData, setFormData] = useState<DepartmentRecord>(initialDept);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSaved, setIsSaved] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Load plants if empty
  useEffect(() => {
    if (plants.length === 0 && fetchPlants) {
      fetchPlants();
    }
  }, [plants.length, fetchPlants]);

  // Load employees if empty
  useEffect(() => {
    if (employees.length === 0) {
      fetch("/api/v1/hr/employees")
        .then((r) => r.json())
        .then((j) => {
          if (j.success && Array.isArray(j.data)) {
            setEmployees(j.data);
          }
        })
        .catch(() => {});
    }
  }, [employees.length, setEmployees]);

  // Department employees
  const deptEmployees = useMemo(() => {
    const fId = (formData.id || "").toLowerCase();
    const fName = (formData.name || "").toLowerCase();

    return employees.filter((e) => {
      if (e.departmentId && (e.departmentId === formData.id || e.departmentId.toLowerCase() === fId)) {
        return true;
      }
      if (fName && (e.departmentName?.toLowerCase() === fName || e.department?.toLowerCase() === fName)) {
        return true;
      }
      return false;
    });
  }, [employees, formData.id, formData.name]);

  const filteredEmployees = useMemo(() => {
    if (!staffSearch.trim()) return deptEmployees;
    const s = staffSearch.toLowerCase();
    return deptEmployees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(s) ||
        (e.badgeNumber || e.badgeNo || "").toLowerCase().includes(s) ||
        (e.positionTitle || e.position || "").toLowerCase().includes(s)
    );
  }, [deptEmployees, staffSearch]);

  const handleUpdate = (updated: Partial<DepartmentRecord>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      addNotification({
        title: "Nom kiritilmagan",
        description: "Iltimos, bo'lim nomini kiriting.",
        severity: "warning",
      });
      return false;
    }

    const isNew =
      !formData.id ||
      formData.id.startsWith("new-") ||
      formData.id.startsWith("dep-") ||
      formData.id.length < 20;

    let savedId = formData.id;

    try {
      const res = await fetch("/api/v1/hr/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          id: isNew ? undefined : formData.id,
        }),
      });
      const json = await res.json();
      if (json.success && json.id) {
        savedId = json.id;
      }
    } catch (e) {
      console.error("Save department error:", e);
    }

    const updatedDept: DepartmentRecord = {
      ...formData,
      id: savedId,
    };

    setFormData(updatedDept);
    upsertDepartment(updatedDept);
    updateTabData(tab.id, updatedDept, `${updatedDept.name} (${updatedDept.code})`);

    if (isNew && tab.id !== `dept-${savedId}`) {
      replaceTabId(
        tab.id,
        `dept-${savedId}`,
        `${updatedDept.name} (${updatedDept.code})`,
        updatedDept
      );
    }

    setTabUnsaved(`dept-${savedId}`, false);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);
    addNotification({
      title: "Bo'lim ma'lumotlari saqlandi",
      description: `${updatedDept.name} yangilandi.`,
      severity: "success",
    });
    setTimeout(() => setIsSaved(false), 2500);
    return true;
  };

  const handleOpenEmployeeDetail = useCallback(
    (emp: EmployeeRecord) => {
      openTab({
        id: `emp-${emp.id}`,
        title: `${emp.fullName} (${emp.badgeNumber || emp.badgeNo})`,
        type: "employee-detail",
        module: "hr",
        documentData: emp,
      });
    },
    [openTab]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const emp = filteredEmployees[rowIndex];
      if (emp) handleOpenEmployeeDetail(emp);
    },
    [filteredEmployees, handleOpenEmployeeDetail]
  );

  const employeeColumns: GridColumn[] = useMemo(
    () => [
      { id: "badgeNo", title: "Tabel №", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "fullName", title: "Xodim F.I.O.", width: 240, icon: GridColumnIcon.HeaderString },
      { id: "position", title: "Lavozim", width: 190, icon: GridColumnIcon.HeaderString },
      { id: "wageType", title: "To'lov shakli", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "currentShift", title: "Smena", width: 100, icon: GridColumnIcon.HeaderString },
      { id: "phone", title: "Telefon", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const emp = filteredEmployees[rowIndex];
      if (!emp) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const col = employeeColumns[colIndex];
      let val = "";

      switch (col.id) {
        case "badgeNo":
          val = emp.badgeNumber || emp.badgeNo || "";
          break;
        case "fullName":
          val = emp.fullName || "";
          break;
        case "position":
          val = emp.positionTitle || emp.position || "—";
          break;
        case "wageType":
          val = emp.wageType || "piecework";
          break;
        case "currentShift":
          val = emp.currentShift || "Kunduzgi";
          break;
        case "phone":
          val = emp.phone || "—";
          break;
        case "status":
          val = emp.status || "active";
          break;
        default:
          val = col.id ? (emp as any)[col.id] ?? "" : "";
      }

      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: true,
      };
    },
    [employeeColumns, filteredEmployees]
  );

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
        title={formData.name || "Yangi sex / bo'lim"}
        docNo={formData.code}
        status={formData.isActive ? "active" : "terminated"}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Chop etish
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSave}
            >
              <Save className="size-3.5" />
              {isSaved ? "Saqlandi" : "Saqlash"}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-primary text-primary-foreground gap-1"
              onClick={async () => {
                const ok = await handleSave();
                if (ok) closeTab(tab.id);
              }}
            >
              <CheckCircle2 className="size-3.5" />
              O&apos;tkazish va yopish
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={Building2}
              title={formData.name || "Yangi bo'lim"}
              subtitle={formData.code}
            >
              <InfoRow label="Sex boshlig'i">
                {formData.headPerson || "Biriktirilmagan"}
              </InfoRow>
              <InfoRow label="Telefon">{formData.phone || "—"}</InfoRow>
              <InfoRow label="Filial">{formData.plant || "Bosh Zavod"}</InfoRow>
              <InfoRow label="Xodimlar shtati">
                <span className="font-mono font-medium">
                  {deptEmployees.length} kishi
                </span>
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
                    Sex / Bo&apos;lim Rekvizitlari
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
                    <Label className="text-xs">Sex / Bo&apos;lim nomi *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleUpdate({ name: e.target.value })}
                      className="h-8 font-medium"
                      placeholder="masalan: Ofset bosma sexi"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Biriktirilgan filial / Zavod</Label>
                    <Select
                      value={formData.branchId || ""}
                      onValueChange={(val) => {
                        const matched = plants.find((p) => p.id === val);
                        handleUpdate({
                          branchId: val,
                          plant: matched?.name || matched?.shortName || formData.plant,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={formData.plant || "Filialni tanlang"} />
                      </SelectTrigger>
                      <SelectContent>
                        {plants.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.code || p.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Sex boshlig&apos;i (Master)</Label>
                    <Input
                      value={formData.headPerson || ""}
                      onChange={(e) => handleUpdate({ headPerson: e.target.value })}
                      className="h-8"
                      placeholder="F.I.O."
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Aloqa telefoni</Label>
                    <PhoneInput
                      value={formData.phone || ""}
                      onChange={(e) => handleUpdate({ phone: e.target.value })}
                      placeholder="+998 71 200-00-00"
                      className="h-8 font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Izoh va texnologik tavsif</Label>
                    <Input
                      value={formData.description || ""}
                      onChange={(e) => handleUpdate({ description: e.target.value })}
                      className="h-8"
                      placeholder="Texnologik operatsiyalar va yo'nalish..."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="space-y-3 flex flex-col h-[calc(100vh-180px)] min-h-[420px]">
              {/* Header and Controls */}
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span>Bo&apos;lim xodimlari</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {filteredEmployees.length} ta
                    </Badge>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-56">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Xodim F.I.O. yoki tabel №..."
                      className="pl-7 h-7 text-xs bg-background"
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const newEmpId = `new-${Date.now()}`;
                      const nextBadge = generateNextCode(
                        "EMP",
                        employees.map((e) => e.badgeNumber || e.badgeNo),
                        4
                      );
                      openTab({
                        id: `emp-${newEmpId}`,
                        title: "Yangi xodim",
                        type: "employee-detail",
                        module: "hr",
                        documentData: {
                          id: newEmpId,
                          badgeNumber: nextBadge,
                          badgeNo: nextBadge,
                          fullName: "",
                          departmentId: formData.id,
                          departmentName: formData.name,
                          department: formData.name,
                          plant: formData.plant,
                          status: "active",
                          wageType: "piecework",
                        },
                        isUnsaved: true,
                      });
                    }}
                  >
                    <Plus className="size-3.5" />
                    <span>Xodim qo&apos;shish</span>
                  </Button>
                </div>
              </div>

              {/* Glide Data Grid Container */}
              <div className="flex-1 rounded-md border border-border bg-card overflow-hidden relative">
                {filteredEmployees.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground space-y-2">
                    <p>Ushbu bo&apos;limga biriktirilgan xodimlar mavjud emas.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        openTab({
                          id: "employees",
                          title: "Xodimlar reyestri",
                          type: "registry",
                          module: "hr",
                        })
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Xodimlar reyestriga o&apos;tish</span>
                    </Button>
                  </div>
                ) : (
                  <DataEditor
                    getCellContent={getCellContent}
                    onCellActivated={handleCellActivated}
                    columns={employeeColumns}
                    rows={filteredEmployees.length}
                    rowMarkers="number"
                    freezeColumns={1}
                    smoothScrollX={true}
                    smoothScrollY={true}
                    width="100%"
                    height="100%"
                    gridSelection={selection}
                    onGridSelectionChange={setSelection}
                    headerHeight={28}
                    rowHeight={30}
                    theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
