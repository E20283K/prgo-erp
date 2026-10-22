"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { EmployeeRecord, EmployeeHistoryItem } from "../types";
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
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  CreditCard,
  Layers,
  CalendarClock,
  Award,
  Save,
  Printer,
  FileCheck,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  History,
  UserX,
  UserCheck,
} from "lucide-react";

interface EmployeeDetailProps {
  tab: DocumentTab;
}

export function EmployeeDetail({ tab }: EmployeeDetailProps) {
  const {
    employees,
    upsertEmployee,
    piecework,
    attendance,
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  const empId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("emp-")) return tab.id.replace("emp-", "");
    return tab.id;
  }, [tab]);

  // Initial employee lookup
  const initialEmp: EmployeeRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.fullName) {
      return tab.documentData;
    }
    const found = employees.find(
      (e) =>
        e.id === empId ||
        (e.badgeNumber || e.badgeNo || "").toLowerCase() === empId.toLowerCase()
    );
    return (
      found || {
        id: empId,
        badgeNumber: "EMP-NEW",
        badgeNo: "EMP-NEW",
        firstName: "",
        lastName: "",
        fullName: tab.title || "Yangi Xodim",
        phone: "+998 ",
        status: "active",
        wageType: "piecework",
        baseSalary: 0,
        hourlyRate: 0,
        pieceworkMultiplier: 1.0,
        pieceworkRateMultiplier: 1.0,
        currentShift: "day",
        hireDate: new Date().toISOString().split("T")[0],
        departmentName: "",
        department: "",
        positionTitle: "",
        position: "",
        plant: "PrintGoo Bosh Zavod",
        skills: [],
      }
    );
  }, [tab.documentData, employees, empId]);

  const [formData, setFormData] = useState<EmployeeRecord>(initialEmp);
  const [activeTab, setActiveTab] = useState<string>(tab.activeLevel3Tab || "overview");
  const [isSaved, setIsSaved] = useState(false);
  const [historyList, setHistoryList] = useState<EmployeeHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch full details and history from API if ID is valid UUID
  useEffect(() => {
    if (empId && empId.length > 20) {
      fetch(`/api/v1/hr/employees/${empId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setFormData(res.data);
          }
        })
        .catch(() => {});

      setHistoryLoading(true);
      fetch(`/api/v1/hr/employees/${empId}/history`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setHistoryList(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [empId]);

  // Filter piecework and attendance for this employee
  const employeePieceworks = useMemo(() => {
    return (piecework || []).filter(
      (pw) =>
        pw.employeeId === formData.id ||
        (pw.badgeNumber || pw.badgeNo) === (formData.badgeNumber || formData.badgeNo)
    );
  }, [piecework, formData]);

  const totalPieceworkEarned = useMemo(() => {
    return employeePieceworks.reduce((sum, pw) => sum + pw.totalAmount, 0);
  }, [employeePieceworks]);

  const employeeAttendance = useMemo(() => {
    return (attendance || []).filter(
      (att) =>
        att.employeeId === formData.id ||
        (att.badgeNumber || att.badgeNo) === (formData.badgeNumber || formData.badgeNo)
    );
  }, [attendance, formData]);

  const totalHoursWorked = useMemo(() => {
    return employeeAttendance.reduce((sum, att) => sum + att.workedHours, 0);
  }, [employeeAttendance]);

  const handleUpdate = (updated: Partial<EmployeeRecord>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      if (formData.id && formData.id.length > 20) {
        await fetch(`/api/v1/hr/employees/${formData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
    } catch {
      // Fallback local save
    }

    upsertEmployee(formData);
    updateTabData(tab.id, formData);
    setTabUnsaved(tab.id, false);
    setIsSaved(true);
    addNotification({
      title: "Xodim ma'lumotlari saqlandi",
      description: `${formData.fullName} (${formData.badgeNumber || formData.badgeNo}) yangilandi.`,
      severity: "success",
    });
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handlePostAndClose = () => {
    handleSave();
    closeTab(tab.id);
  };

  const handleToggleStatus = (newStatus: "active" | "terminated") => {
    handleUpdate({ status: newStatus });
    addNotification({
      title: newStatus === "terminated" ? "Xodim bo'shatildi" : "Xodim faollashtirildi",
      description: `${formData.fullName} holati o'zgartirildi.`,
      severity: newStatus === "terminated" ? "warning" : "success",
    });
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Umumiy ma'lumotlar", icon: User },
    { id: "wage", label: "Ish haqi va stavkalar", icon: CreditCard },
    {
      id: "piecework",
      label: "Ishbay naryadlar (Sdelka)",
      icon: Layers,
      badge: employeePieceworks.length > 0 ? String(employeePieceworks.length) : null,
    },
    {
      id: "attendance",
      label: "Davomat va Tabel T-13",
      icon: CalendarClock,
      badge: employeeAttendance.length > 0 ? `${totalHoursWorked} soat` : null,
    },
    { id: "skills", label: "Malaka va ruxsatnomalar", icon: Award },
    {
      id: "history",
      label: "O'zgarishlar tarixi",
      icon: History,
      badge: historyList.length > 0 ? String(historyList.length) : null,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      {/* ── Level 2: Document Header (1C Style) ── */}
      <DocumentHeader
        icon={User}
        title={formData.fullName}
        docNo={formData.badgeNumber || formData.badgeNo || "EMP-0000"}
        status={formData.status}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Chop etish (T-2)
            </Button>

            {formData.status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                onClick={() => handleToggleStatus("terminated")}
              >
                <UserX className="size-3.5" />
                Ishdan bo'shatish
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 gap-1"
                onClick={() => handleToggleStatus("active")}
              >
                <UserCheck className="size-3.5" />
                Faol holatga qaytarish
              </Button>
            )}

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
              onClick={handlePostAndClose}
            >
              <CheckCircle2 className="size-3.5" />
              O'tkazish va yopish
            </Button>
          </div>
        }
      />

      {/* ── Main Layout: Sidebar + Document Workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Document Sidebar */}
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={User}
              title={formData.fullName}
              subtitle={formData.positionTitle || formData.position || "Lavozim biriktirilmagan"}
            >
              <InfoRow label="Sex/Bo'lim">{formData.departmentName || formData.department || "—"}</InfoRow>
              <InfoRow label="Filial">{formData.plant || "PrintGoo Bosh Zavod"}</InfoRow>
              <InfoRow label="Stavka">{formData.wageType}</InfoRow>
              <InfoRow label="Oklad">
                <span className="font-mono font-medium">
                  {formData.baseSalary.toLocaleString("uz-UZ")} UZS
                </span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="Hujjat bo'limlari"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
          footer={
            <div className="space-y-1.5 text-[11px]">
              <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Oylik ko'rsatkichlar
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ishbay summa:</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {totalPieceworkEarned.toLocaleString("uz-UZ")} UZS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ish soatlari:</span>
                <span className="font-mono font-medium">{totalHoursWorked} soat</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Smena:</span>
                <span className="text-[10px] text-primary">{formData.currentShift}</span>
              </div>
            </div>
          }
        />

        {/* Right Content Area: Level 3 Tabs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4 max-w-4xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="size-4 text-primary" />
                    Xodimning shaxsiy ma'lumotlari
                  </CardTitle>
                  <CardDescription className="text-xs">
                    T-2 shaxsiy kartochkasi va pasport rekvizitlari
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tabel raqami *</Label>
                    <Input
                      value={formData.badgeNumber || formData.badgeNo || ""}
                      onChange={(e) =>
                        handleUpdate({ badgeNumber: e.target.value, badgeNo: e.target.value })
                      }
                      className="h-8 font-mono font-semibold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">To'liq F.I.O. *</Label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => handleUpdate({ fullName: e.target.value })}
                      className="h-8 font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Sex / Bo'lim *</Label>
                    <Select
                      value={formData.departmentName || formData.department || ""}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ departmentName: val, department: val });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Flekso bosma sexi">Flekso bosma sexi</SelectItem>
                        <SelectItem value="Tikuvchilik va lenta sexi">Tikuvchilik va lenta sexi</SelectItem>
                        <SelectItem value="Kesish va qadoqlash sexi">Kesish va qadoqlash sexi</SelectItem>
                        <SelectItem value="Prepress va dizayn">Prepress va dizayn</SelectItem>
                        <SelectItem value="Sifat nazorati (OTK)">Sifat nazorati (OTK)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Lavozim *</Label>
                    <Input
                      value={formData.positionTitle || formData.position || ""}
                      onChange={(e) =>
                        handleUpdate({ positionTitle: e.target.value, position: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Holati (Status) *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ status: val as any });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Faol (Active)</SelectItem>
                        <SelectItem value="probation">Sinov muddatida</SelectItem>
                        <SelectItem value="on_leave">Mehnat ta'tilida</SelectItem>
                        <SelectItem value="terminated">Ishdan bo'shatilgan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Telefon raqami *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleUpdate({ phone: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Elektron pochta</Label>
                    <Input
                      value={formData.email || ""}
                      onChange={(e) => handleUpdate({ email: e.target.value })}
                      className="h-8"
                      placeholder="xodim@printgoo.uz"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Ishga qabul qilingan sana *</Label>
                    <Input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => handleUpdate({ hireDate: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Passport & Legal Data */}
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Pasport va Soliq rekvizitlari
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Pasport seriya va raqam</Label>
                    <Input
                      value={formData.passportNo || formData.passportNumber || ""}
                      onChange={(e) =>
                        handleUpdate({ passportNo: e.target.value, passportNumber: e.target.value })
                      }
                      className="h-8 font-mono uppercase"
                      placeholder="AA 1234567"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">JSHSHIR (PINFL - 14 raqam)</Label>
                    <Input
                      value={formData.pinfl || ""}
                      onChange={(e) => handleUpdate({ pinfl: e.target.value })}
                      className="h-8 font-mono"
                      maxLength={14}
                      placeholder="31502910010023"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Biriktirilgan korxona / filial</Label>
                    <Input
                      value={formData.plant || "PrintGoo Bosh Zavod"}
                      onChange={(e) => handleUpdate({ plant: e.target.value })}
                      className="h-8"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <Label className="text-xs">Qo'shimcha izohlar va ma'lumotlar</Label>
                    <Input
                      value={formData.notes || ""}
                      onChange={(e) => handleUpdate({ notes: e.target.value })}
                      className="h-8"
                      placeholder="Xodim bo'yicha maxsus ko'rsatmalar..."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: WAGE & RATES */}
          {activeTab === "wage" && (
            <div className="space-y-4 max-w-4xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="size-4 text-emerald-600" />
                    Mehnatga haq to'lash tizimi va Stavka
                  </CardTitle>
                  <CardDescription className="text-xs">
                    1C oylik va ishlab chiqarish ishbay (сдельщина) sozlamalari
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">To'lov shakli (Wage Type) *</Label>
                    <Select
                      value={formData.wageType}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ wageType: val as any });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piecework">Ishbay (Faqat sdelka)</SelectItem>
                        <SelectItem value="mixed">Aralash (Oklad + Ishbay)</SelectItem>
                        <SelectItem value="salary">Oklad (Sobit oylik)</SelectItem>
                        <SelectItem value="hourly">Soatbay stavka</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Asosiy oklad (UZS) *</Label>
                    <Input
                      type="number"
                      value={formData.baseSalary}
                      onChange={(e) => handleUpdate({ baseSalary: Number(e.target.value) || 0 })}
                      className="h-8 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Ishbay koeffitsiyenti (K-tarif)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={formData.pieceworkMultiplier || formData.pieceworkRateMultiplier || 1.0}
                      onChange={(e) =>
                        handleUpdate({
                          pieceworkMultiplier: Number(e.target.value) || 1.0,
                          pieceworkRateMultiplier: Number(e.target.value) || 1.0,
                        })
                      }
                      className="h-8 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Soatbay stavka (UZS/soat)</Label>
                    <Input
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) => handleUpdate({ hourlyRate: Number(e.target.value) || 0 })}
                      className="h-8 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Ish haqi bank kartasi (Uzcard / Humo)</Label>
                    <Input
                      value={formData.bankCardNo || ""}
                      onChange={(e) => handleUpdate({ bankCardNo: e.target.value })}
                      className="h-8 font-mono"
                      placeholder="8600 **** **** ****"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Wage Calculation Rules Explanatory Box */}
              <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                <div className="font-semibold text-xs text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  PrintGoo Ishbay hisoblash qoidasi (Formula)
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Ishbay xodimlar uchun oylik maosh:{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-foreground font-semibold">
                    Jami maosh = Asosiy oklad + (Bajarilgan operatsiyalar hajmi × Birlik tarifi × K-tarif) + Bonuslar - Ushlanmalar
                  </code>
                  . Barcha bajarilgan operatsiyalar ishlab chiqarishdagi <strong>Work Order</strong> yopilishida sex masteri tomonidan tasdiqlanadi.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PIECEWORK HISTORY */}
          {activeTab === "piecework" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    Bajarilgan ishbay naryadlar reyestri
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Work Orderlar bo'yicha bajarilgan flekso bosma, kesish va tikuvchilik operatsiyalari
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                  Jami sdelka: {totalPieceworkEarned.toLocaleString("uz-UZ")} UZS
                </Badge>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Sana</th>
                      <th className="px-3 py-1">Work Order №</th>
                      <th className="px-3 py-1">Stanok / Mashina</th>
                      <th className="px-3 py-1">Operatsiya</th>
                      <th className="px-3 py-1 text-right">Bajarilgan hajm</th>
                      <th className="px-3 py-1 text-right">Tarif</th>
                      <th className="px-3 py-1 text-right">Summa (UZS)</th>
                      <th className="px-3 py-1">Holati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeePieceworks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
                          Hozircha ishbay naryadlar qayd etilmagan.
                        </td>
                      </tr>
                    ) : (
                      employeePieceworks.map((pw) => (
                        <tr key={pw.id} className="border-b hover:bg-muted/30 h-7">
                          <td className="px-3 py-1 font-mono text-[11px]">{pw.workDate || pw.date}</td>
                          <td className="px-3 py-1 font-mono font-semibold text-primary">
                            {pw.workOrderId}
                          </td>
                          <td className="px-3 py-1">{pw.machineCode || pw.machine}</td>
                          <td className="px-3 py-1 font-medium">{pw.operationName || pw.operation}</td>
                          <td className="px-3 py-1 text-right font-mono">
                            {(pw.completedQuantity || pw.quantity || 0).toLocaleString("uz-UZ")} {pw.unit}
                          </td>
                          <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                            {(pw.pieceRate || pw.rate || 0).toLocaleString("uz-UZ")}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {pw.totalAmount.toLocaleString("uz-UZ")}
                          </td>
                          <td className="px-3 py-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4.5 px-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300"
                            >
                              {pw.status}
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

          {/* TAB 4: ATTENDANCE & TIMESHEET */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" />
                    T-13 Davomat va Ish vaqti tabeli
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Elektron turniket va biometrik Face ID qaydlari
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    Ishlangan: {totalHoursWorked} soat
                  </Badge>
                </div>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Sana</th>
                      <th className="px-3 py-1">Smena</th>
                      <th className="px-3 py-1">Kirish</th>
                      <th className="px-3 py-1">Chiqish</th>
                      <th className="px-3 py-1 text-right">Ish soati</th>
                      <th className="px-3 py-1 text-right">Kechikish</th>
                      <th className="px-3 py-1">Status</th>
                      <th className="px-3 py-1">Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
                          Davomat yozuvlari mavjud emas.
                        </td>
                      </tr>
                    ) : (
                      employeeAttendance.map((att) => (
                        <tr key={att.id} className="border-b hover:bg-muted/30 h-7">
                          <td className="px-3 py-1 font-mono text-[11px]">{att.workDate || att.date}</td>
                          <td className="px-3 py-1 text-[11px]">{att.shiftType || att.shift}</td>
                          <td className="px-3 py-1 font-mono">{att.checkIn || "—"}</td>
                          <td className="px-3 py-1 font-mono">{att.checkOut || "—"}</td>
                          <td className="px-3 py-1 text-right font-mono font-medium">
                            {att.workedHours} soat
                          </td>
                          <td className="px-3 py-1 text-right font-mono">
                            {att.delayMinutes > 0 ? (
                              <span className="text-red-600 font-semibold">
                                +{att.delayMinutes} daq
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4.5 px-1.5 ${
                                att.status === "present"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                  : att.status === "late"
                                  ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {att.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-1 text-muted-foreground text-[11px]">
                            {att.notes || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SKILLS & CERTIFICATES */}
          {activeTab === "skills" && (
            <div className="space-y-4 max-w-4xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Award className="size-4 text-primary" />
                    Kasbiy ko'nikmalar va stanoklarga ruxsatnomalar
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">
                      O'zlashtirilgan uskunalar va texnologiyalar:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {(formData.skills || []).map((skill, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs font-medium flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded border bg-muted/20 space-y-1.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <FileCheck className="size-4 text-emerald-600" />
                        Mehnat xavfsizligi va texnika yo'riqnomasi
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Oxirgi instruktaj o'tkazilgan sana: <strong>2026-09-01</strong>. Toifa: Flekso bosma mashinalari elektr va mexanik xavfsizligi.
                      </p>
                    </div>

                    <div className="p-3 rounded border bg-muted/20 space-y-1.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-blue-600" />
                        Tibbiy ko'rik va poliklinika xulosasi
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Davriy tibbiy ko'rik: O'tgan (2026-08-10). Amal qilish muddati: 2027-08-10 gacha.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 6: HISTORY OF CHANGES */}
          {activeTab === "history" && (
            <div className="space-y-4 max-w-4xl">
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Kadrlar Harakati Tarixi (Employee Audit Trail)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Lavozim, ish haqi va bo'lim o'zgarishlarining to'liq tarixi
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {historyLoading ? (
                    <div className="text-center py-6 text-muted-foreground">Tarix yuklanmoqda...</div>
                  ) : historyList.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Ushbu xodim bo'yicha o'zgarishlar tarixi mavjud emas.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyList.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded border bg-muted/20 flex items-start justify-between text-xs"
                        >
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {item.changeType}
                              </Badge>
                              <span>O'zgartirdi: {item.changedBy || "Tizim"}</span>
                            </div>
                            <div className="text-muted-foreground text-[11px]">
                              Eski qiymat:{" "}
                              <span className="font-mono">{JSON.stringify(item.oldValue)}</span>
                            </div>
                            <div className="text-primary text-[11px] font-medium">
                              Yangi qiymat:{" "}
                              <span className="font-mono">{JSON.stringify(item.newValue)}</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {new Date(item.changedAt).toLocaleString("uz-UZ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
