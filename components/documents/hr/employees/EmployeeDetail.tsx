"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  ShieldCheck,
  CheckCircle2,
  History,
  UserX,
  UserCheck,
  X,
  Plus,
  Loader2,
  Camera,
  Upload,
  Trash2,
} from "lucide-react";

interface EmployeeDetailProps {
  tab: DocumentTab;
}

// Helper to split full name into last name, first name, middle name if not already set
function parseFIO(emp: EmployeeRecord): EmployeeRecord {
  let fName = emp.firstName || "";
  let lName = emp.lastName || "";
  let mName = emp.middleName || "";

  if (!lName && !fName && emp.fullName) {
    const parts = emp.fullName.trim().split(/\s+/);
    lName = parts[0] || "";
    fName = parts[1] || "";
    mName = parts.slice(2).join(" ") || "";
  }

  const computedFullName = emp.fullName || [lName, fName, mName].filter(Boolean).join(" ").trim();

  return {
    ...emp,
    firstName: fName,
    lastName: lName,
    middleName: mName,
    fullName: computedFullName,
  };
}

function getInitials(name?: string): string {
  if (!name) return "X";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmployeeDetail({ tab }: EmployeeDetailProps) {
  const {
    employees,
    upsertEmployee,
    piecework,
    attendance,
    setTabUnsaved,
    updateTabData,
    replaceTabId,
    closeTab,
    addNotification,
    departmentsList,
  } = useWorkspaceStore();

  const isInitialNew = useMemo(() => {
    const docId = tab.documentData?.id || tab.id;
    return (
      docId.startsWith("emp-new") ||
      docId === "new" ||
      Boolean((tab.documentData as any)?.isNew)
    );
  }, [tab]);

  const [isNewRecord, setIsNewRecord] = useState(isInitialNew);

  const empId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("emp-")) return tab.id.replace("emp-", "");
    return tab.id;
  }, [tab]);

  // Initial employee lookup
  const initialEmp: EmployeeRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.fullName) {
      return parseFIO(tab.documentData);
    }
    if (tab.documentData && isInitialNew) {
      return parseFIO(tab.documentData);
    }
    const found = employees.find(
      (e) =>
        e.id === empId ||
        (e.badgeNumber || e.badgeNo || "").toLowerCase() === empId.toLowerCase()
    );
    if (found) {
      return parseFIO(found);
    }
    return {
      id: empId,
      badgeNumber: "EMP-0001",
      badgeNo: "EMP-0001",
      firstName: "",
      lastName: "",
      middleName: "",
      fullName: isInitialNew ? "" : (tab.title || "Yangi xodim"),
      phone: "",
      email: "",
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
      avatarUrl: null,
    };
  }, [tab.documentData, isInitialNew, employees, empId, tab.title]);

  const [formData, setFormData] = useState<EmployeeRecord>(initialEmp);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>(tab.activeLevel3Tab || "overview");
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyList, setHistoryList] = useState<EmployeeHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newSkillText, setNewSkillText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch full details and history from API if ID is valid UUID and not draft
  useEffect(() => {
    if (!isInitialNew && empId && empId.length > 20 && !empId.startsWith("emp-new")) {
      fetch(`/api/v1/hr/employees/${empId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setFormData(parseFIO(res.data));
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
  }, [empId, isInitialNew]);

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
    setErrors((prev) => {
      const copy = { ...prev };
      Object.keys(updated).forEach((k) => delete copy[k]);
      return copy;
    });
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addNotification({
        title: "Xatolik",
        description: "Faqat rasm formatidagi fayllarni yuklash mumkin (JPG, PNG, WebP).",
        severity: "error",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addNotification({
        title: "Xatolik",
        description: "Fayl hajmi 5MB dan oshmasligi kerak.",
        severity: "error",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleUpdate({ avatarUrl: result });
      addNotification({
        title: "Rasm yuklandi",
        description: "Xodim fotosurati biriktirildi.",
        severity: "success",
      });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleUpdate({ avatarUrl: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddSkill = () => {
    const s = newSkillText.trim();
    if (!s) return;
    const current = formData.skills || [];
    if (!current.includes(s)) {
      handleUpdate({ skills: [...current, s] });
    }
    setNewSkillText("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const current = formData.skills || [];
    handleUpdate({ skills: current.filter((s) => s !== skillToRemove) });
  };

  const departmentOptions = useMemo(() => {
    const list = (departmentsList || []).map((d) => d.name);
    const defaults = [
      "Flekso bosma sexi",
      "Tikuvchilik va lenta sexi",
      "Kesish va qadoqlash sexi",
      "Prepress va dizayn",
      "Sifat nazorati (OTK)",
      "Ombor va logistika",
      "Boshqaruv va ma'muriyat",
    ];
    const combined = Array.from(new Set([...list, ...defaults]));
    const current = formData.departmentName || formData.department;
    if (current && !combined.includes(current)) {
      combined.push(current);
    }
    return combined;
  }, [departmentsList, formData.departmentName, formData.department]);

  const handleSave = async (shouldClose = false) => {
    const lName = formData.lastName?.trim() || "";
    const fName = formData.firstName?.trim() || "";
    const mName = formData.middleName?.trim() || "";
    const dept = formData.departmentName?.trim() || formData.department?.trim() || "";
    const pos = formData.positionTitle?.trim() || formData.position?.trim() || "";
    const phone = formData.phone?.trim() || "";
    const hireDate = formData.hireDate?.trim() || "";

    const computedFullName =
      [lName, fName, mName].filter(Boolean).join(" ").trim() || formData.fullName?.trim() || "";

    const newErrors: Record<string, string> = {};
    if (!lName) newErrors.lastName = "Familiyani kiriting";
    if (!fName) newErrors.firstName = "Ismni kiriting";
    if (!dept) newErrors.departmentName = "Sex / Bo'limni tanlang";
    if (!pos) newErrors.positionTitle = "Lavozimni kiriting";
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      newErrors.phone = "Telefon raqamini kiriting (kamida 7 ta raqam)";
    }
    if (!hireDate) newErrors.hireDate = "Qabul sanasini ko'rsating";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (activeTab !== "overview") setActiveTab("overview");
      addNotification({
        title: "Majburiy maydonlar to'ldirilmadi",
        description: "Iltimos, yulduzcha (*) bilan belgilangan maydonlarni to'ldiring.",
        severity: "error",
      });
      return false;
    }

    setErrors({});
    setSaving(true);
    let currentId = formData.id;

    try {
      const payload: Partial<EmployeeRecord> = {
        ...formData,
        firstName: fName,
        lastName: lName,
        middleName: mName || null,
        fullName: computedFullName,
        avatarUrl: formData.avatarUrl || null,
        badgeNumber:
          formData.badgeNumber?.trim() ||
          formData.badgeNo?.trim() ||
          `EMP-${Date.now().toString().slice(-4)}`,
        badgeNo:
          formData.badgeNumber?.trim() ||
          formData.badgeNo?.trim() ||
          `EMP-${Date.now().toString().slice(-4)}`,
      };

      if (isNewRecord) {
        const res = await fetch("/api/v1/hr/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();

        if (!res.ok || !json.success || !json.employeeId) {
          throw new Error(json.error || "Xodimni saqlashda xatolik yuz berdi");
        }

        const createdId = json.employeeId;
        const finalRecord: EmployeeRecord = {
          ...formData,
          ...payload,
          id: createdId,
        };

        currentId = createdId;
        setFormData(finalRecord);
        setIsNewRecord(false);
        upsertEmployee(finalRecord);
        replaceTabId(
          tab.id,
          `emp-${createdId}`,
          `${finalRecord.fullName} (${finalRecord.badgeNumber || finalRecord.badgeNo})`,
          finalRecord
        );
        setTabUnsaved(`emp-${createdId}`, false);
        setIsSaved(true);
        addNotification({
          title: "Xodim qo'shildi",
          description: `${finalRecord.fullName} muvaffaqiyatli ro'yxatga olindi.`,
          severity: "success",
        });
      } else {
        if (formData.id && formData.id.length > 20) {
          const res = await fetch(`/api/v1/hr/employees/${formData.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || "Xodimni yangilashda xatolik yuz berdi");
          }
        }
        const updatedRecord = { ...formData, ...payload };
        setFormData(updatedRecord);
        upsertEmployee(updatedRecord);
        updateTabData(
          tab.id,
          updatedRecord,
          `${updatedRecord.fullName} (${updatedRecord.badgeNumber || updatedRecord.badgeNo})`
        );
        setTabUnsaved(tab.id, false);
        setIsSaved(true);
        addNotification({
          title: "Xodim saqlandi",
          description: `${updatedRecord.fullName} ma'lumotlari yangilandi.`,
          severity: "success",
        });
      }

      setTimeout(() => setIsSaved(false), 2500);

      if (shouldClose) {
        closeTab(isNewRecord ? `emp-${currentId}` : tab.id);
      }
      return true;
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err?.message || "Xodimni saqlashda server xatoligi yuz berdi.",
        severity: "error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePostAndClose = () => {
    handleSave(true);
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
      label: "Ishbay naryadlar",
      icon: Layers,
      badge: employeePieceworks.length > 0 ? String(employeePieceworks.length) : null,
    },
    {
      id: "attendance",
      label: "Davomat",
      icon: CalendarClock,
      badge: employeeAttendance.length > 0 ? `${totalHoursWorked} soat` : null,
    },
    { id: "skills", label: "Malaka va ruxsatnomalar", icon: Award },
    {
      id: "history",
      label: "Tarix",
      icon: History,
      badge: historyList.length > 0 ? String(historyList.length) : null,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground text-xs select-none">
      {/* ── Level 2: Document Header ── */}
      <DocumentHeader
        icon={User}
        title={formData.fullName.trim() || (isNewRecord ? "Yangi xodim (Qoralama)" : "Nomsiz xodim")}
        docNo={formData.badgeNumber || formData.badgeNo || "EMP-0000"}
        status={isNewRecord ? "Qoralama" : formData.status}
        actions={
          <div className="flex items-center gap-1.5">
            {!isNewRecord && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.print()}
                >
                  <Printer className="size-3.5" />
                  Chop etish
                </Button>

                {formData.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => handleToggleStatus("terminated")}
                  >
                    <UserX className="size-3.5" />
                    Bo'shatish
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 gap-1"
                    onClick={() => handleToggleStatus("active")}
                  >
                    <UserCheck className="size-3.5" />
                    Faollashtirish
                  </Button>
                )}
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={saving}
              onClick={() => handleSave(false)}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {isSaved ? "Saqlandi" : "Saqlash"}
            </Button>

            <Button
              size="sm"
              className="h-7 text-xs bg-primary text-primary-foreground gap-1"
              disabled={saving}
              onClick={handlePostAndClose}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
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
              avatar={
                formData.avatarUrl ? (
                  <Avatar size="sm" className="size-8">
                    <AvatarImage src={formData.avatarUrl} alt={formData.fullName} className="object-cover" />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(formData.fullName)}
                    </AvatarFallback>
                  </Avatar>
                ) : undefined
              }
              icon={!formData.avatarUrl ? User : undefined}
              title={formData.fullName.trim() || (isNewRecord ? "Yangi xodim" : "Nomsiz xodim")}
              subtitle={formData.positionTitle || formData.position || "Lavozim biriktirilmagan"}
            >
              <InfoRow label="Sex/Bo'lim">{formData.departmentName || formData.department || "—"}</InfoRow>
              <InfoRow label="Filial">{formData.plant || "PrintGoo Bosh Zavod"}</InfoRow>
              <InfoRow label="To'lov turi">{formData.wageType}</InfoRow>
              <InfoRow label="Oklad">
                <span className="font-mono font-medium">
                  {Number(formData.baseSalary || 0).toLocaleString("uz-UZ")} UZS
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
                    Xodim ma'lumotlari
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* 3x4 Photo Container */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 self-center sm:self-start">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative w-28 h-36 rounded-md border-2 border-dashed border-border hover:border-primary/60 bg-muted/30 hover:bg-muted/50 cursor-pointer overflow-hidden flex flex-col items-center justify-center transition-colors"
                        title="Fotosurat yuklash uchun bosing"
                      >
                        {formData.avatarUrl ? (
                          <>
                            <img
                              src={formData.avatarUrl}
                              alt={formData.fullName}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium transition-opacity">
                              <Camera className="size-4" />
                              <span>O'zgartirish</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground gap-1.5">
                            <Camera className="size-6 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                            <span className="text-[10px] leading-tight font-medium">Fotosurat (3x4)</span>
                            <span className="text-[9px] text-muted-foreground/60">Yuklash</span>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handlePhotoSelect}
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="size-3" />
                          {formData.avatarUrl ? "Almashtirish" : "Yuklash"}
                        </Button>
                        {formData.avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-1.5 text-destructive hover:bg-destructive/10"
                            onClick={handleRemovePhoto}
                            title="Rasmni o'chirish"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Form Fields Grid */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
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

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Familiya *</Label>
                          {errors.lastName && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.lastName}
                            </span>
                          )}
                        </div>
                        <Input
                          value={formData.lastName || ""}
                          onChange={(e) => {
                            const lName = e.target.value;
                            const fName = formData.firstName || "";
                            const mName = formData.middleName || "";
                            const full = [lName, fName, mName].filter(Boolean).join(" ").trim();
                            handleUpdate({
                              lastName: lName,
                              fullName: full,
                            });
                          }}
                          placeholder="Masalan: Karimov"
                          className={`h-8 font-medium ${errors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Ism *</Label>
                          {errors.firstName && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.firstName}
                            </span>
                          )}
                        </div>
                        <Input
                          value={formData.firstName || ""}
                          onChange={(e) => {
                            const fName = e.target.value;
                            const lName = formData.lastName || "";
                            const mName = formData.middleName || "";
                            const full = [lName, fName, mName].filter(Boolean).join(" ").trim();
                            handleUpdate({
                              firstName: fName,
                              fullName: full,
                            });
                          }}
                          placeholder="Masalan: Sardor"
                          className={`h-8 font-medium ${errors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>

                      <div>
                        <Label className="text-xs mb-1 block">Otasining ismi</Label>
                        <Input
                          value={formData.middleName || ""}
                          onChange={(e) => {
                            const mName = e.target.value;
                            const lName = formData.lastName || "";
                            const fName = formData.firstName || "";
                            const full = [lName, fName, mName].filter(Boolean).join(" ").trim();
                            handleUpdate({
                              middleName: mName,
                              fullName: full,
                            });
                          }}
                          placeholder="Masalan: Anvarovich"
                          className="h-8 font-medium"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Sex / Bo'lim *</Label>
                          {errors.departmentName && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.departmentName}
                            </span>
                          )}
                        </div>
                        <Select
                          value={formData.departmentName || formData.department || ""}
                          onValueChange={(val) => {
                            if (val) handleUpdate({ departmentName: val, department: val });
                          }}
                        >
                          <SelectTrigger className={`h-8 ${errors.departmentName ? "border-destructive focus:ring-destructive" : ""}`}>
                            <SelectValue placeholder="Bo'limni tanlang..." />
                          </SelectTrigger>
                          <SelectContent>
                            {departmentOptions.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Lavozim *</Label>
                          {errors.positionTitle && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.positionTitle}
                            </span>
                          )}
                        </div>
                        <Input
                          value={formData.positionTitle || formData.position || ""}
                          onChange={(e) =>
                            handleUpdate({ positionTitle: e.target.value, position: e.target.value })
                          }
                          placeholder="Masalan: Pechatnik"
                          className={`h-8 ${errors.positionTitle ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>

                      <div>
                        <Label className="text-xs mb-1 block">Holati *</Label>
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
                            <SelectItem value="active">Faol</SelectItem>
                            <SelectItem value="probation">Sinov</SelectItem>
                            <SelectItem value="on_leave">Mehnat ta'tilida</SelectItem>
                            <SelectItem value="terminated">Ishdan bo'shatilgan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Telefon raqami *</Label>
                          {errors.phone && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.phone}
                            </span>
                          )}
                        </div>
                        <Input
                          value={formData.phone || ""}
                          onChange={(e) => handleUpdate({ phone: e.target.value })}
                          placeholder="+998 90 123-45-67"
                          className={`h-8 font-mono ${errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>

                      <div>
                        <Label className="text-xs mb-1 block">Elektron pochta</Label>
                        <Input
                          value={formData.email || ""}
                          onChange={(e) => handleUpdate({ email: e.target.value })}
                          className="h-8"
                          placeholder="xodim@printgoo.uz"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">Ishga qabul sanasi *</Label>
                          {errors.hireDate && (
                            <span className="text-[10px] text-destructive font-medium">
                              {errors.hireDate}
                            </span>
                          )}
                        </div>
                        <Input
                          type="date"
                          value={formData.hireDate}
                          onChange={(e) => handleUpdate({ hireDate: e.target.value })}
                          className={`h-8 font-mono ${errors.hireDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Smena grafigi *</Label>
                        <Select
                          value={formData.currentShift || "day"}
                          onValueChange={(val) => {
                            if (val) handleUpdate({ currentShift: val });
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Kunduzgi smena A (08:00–20:00)</SelectItem>
                            <SelectItem value="night">Tungi smena B (20:00–08:00)</SelectItem>
                            <SelectItem value="daily">Ofis / Standart (09:00–18:00)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Passport & Legal Data */}
              <Card>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Pasport va soliq rekvizitlari
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
                    <Label className="text-xs">JSHSHIR (PINFL)</Label>
                    <Input
                      value={formData.pinfl || ""}
                      onChange={(e) => handleUpdate({ pinfl: e.target.value })}
                      className="h-8 font-mono"
                      maxLength={14}
                      placeholder="31502910010023"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Korxona / filial</Label>
                    <Input
                      value={formData.plant || "PrintGoo Bosh Zavod"}
                      onChange={(e) => handleUpdate({ plant: e.target.value })}
                      className="h-8"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <Label className="text-xs">Qo'shimcha izohlar</Label>
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
                    Mehnatga haq to'lash stavkalari
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">To'lov shakli *</Label>
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
                        <SelectItem value="piecework">Ishbay</SelectItem>
                        <SelectItem value="mixed">Aralash</SelectItem>
                        <SelectItem value="salary">Oklad</SelectItem>
                        <SelectItem value="hourly">Soatbay</SelectItem>
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

              {/* Wage Calculation Rules Box */}
              <div className="p-3.5 rounded border bg-muted/20 space-y-1.5">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Ishbay hisoblash qoidasi
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed font-mono">
                  Jami maosh = Asosiy oklad + (Bajarilgan hajm × Tarif × K-tarif) + Bonuslar - Ushlanmalar
                </div>
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
                    Bajarilgan ishbay naryadlar
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                >
                  Jami: {totalPieceworkEarned.toLocaleString("uz-UZ")} UZS
                </Badge>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                      <th className="px-3 py-1">Sana</th>
                      <th className="px-3 py-1">Work Order №</th>
                      <th className="px-3 py-1">Stanok</th>
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
                    Davomat tabeli
                  </h3>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Ishlangan: {totalHoursWorked} soat
                </Badge>
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
                      O'zlashtirilgan uskunalar va texnologiyalar
                    </Label>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {(formData.skills || []).map((skill, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs font-medium flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="text-muted-foreground hover:text-destructive ml-1"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 max-w-md">
                      <Input
                        value={newSkillText}
                        onChange={(e) => setNewSkillText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSkill();
                          }
                        }}
                        placeholder="Yangi ko'nikma yoki stanok nomi..."
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 shrink-0"
                        onClick={handleAddSkill}
                      >
                        <Plus className="size-3.5" />
                        Qo'shish
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded border bg-muted/20 space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <FileCheck className="size-4 text-emerald-600" />
                        Mehnat xavfsizligi yo'riqnomasi
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Flekso bosma mashinalari elektr va mexanik xavfsizligi bo'yicha yo'riqnoma o'tkazilgan.
                      </div>
                    </div>

                    <div className="p-3 rounded border bg-muted/20 space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-blue-600" />
                        Tibbiy ko'rik xulosasi
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Yillik davriy tibbiy ko'rikdan o'tgan va ishlab chiqarish sexiga ruxsat etilgan.
                      </div>
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
                    Kadrlar harakati tarixi
                  </CardTitle>
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
                              Eski: <span className="font-mono">{JSON.stringify(item.oldValue)}</span>
                            </div>
                            <div className="text-primary text-[11px] font-medium">
                              Yangi: <span className="font-mono">{JSON.stringify(item.newValue)}</span>
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
