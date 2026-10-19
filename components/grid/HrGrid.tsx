"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  EmployeeRecord,
  AttendanceRecord,
  PieceworkRecord,
  PayrollRecord,
  DepartmentRecord,
  ShiftRecord,
} from "@/components/documents/hr/types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserCheck,
  CalendarClock,
  Award,
  Calculator,
  Building2,
  Clock,
  Plus,
  Search,
  Download,
  Printer,
  ExternalLink,
  Layers,
  Banknote,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from "lucide-react";

export interface HrGridProps {
  type?: "employees" | "departments" | "attendance" | "shifts" | "piecework" | "payroll";
}

export function HrGrid({ type = "employees" }: HrGridProps) {
  const tCommon = useTranslations("Common");
  const tMod = useTranslations("Modules");
  const {
    theme,
    openTab,
    employees,
    upsertEmployee,
    attendance,
    upsertAttendance,
    piecework,
    upsertPiecework,
    payrolls,
    upsertPayroll,
    departmentsList,
    shiftsList,
    updateGridStats,
  } = useWorkspaceStore();

  const isDark = theme === "dark";
  const [activeView, setActiveView] = useState<
    "employees" | "departments" | "attendance" | "shifts" | "piecework" | "payroll"
  >(type);

  // Sync prop changes
  useEffect(() => {
    if (type) setActiveView(type);
  }, [type]);

  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Modal / Drawer state
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddPieceworkOpen, setIsAddPieceworkOpen] = useState(false);

  // New Employee Form State
  const [newBadgeNo, setNewBadgeNo] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newDepartment, setNewDepartment] = useState("Flekso bosma sexi");
  const [newPosition, setNewPosition] = useState("Pechatnik");
  const [newWageType, setNewWageType] = useState<any>("Piecework");
  const [newBaseSalary, setNewBaseSalary] = useState("3500000");
  const [newPhone, setNewPhone] = useState("+998 90 ");

  // New Piecework Form State
  const [pwWorkOrderId, setPwWorkOrderId] = useState("WO-00351");
  const [pwEmployeeId, setPwEmployeeId] = useState("");
  const [pwMachine, setPwMachine] = useState("Mark Andy 2200 #1");
  const [pwOperation, setPwOperation] = useState("Flekso bosma (Samo-kleyka yorliq)");
  const [pwQuantity, setPwQuantity] = useState("10000");
  const [pwUnit, setPwUnit] = useState("dona");
  const [pwRate, setPwRate] = useState("18.5");

  // Summary Metrics
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter((e) => e.status === "Active").length;

  const todayPresentCount = attendance.filter((a) => a.status === "Present" || a.status === "Late").length;
  const todayLateCount = attendance.filter((a) => a.status === "Late").length;

  const totalPieceworkSum = useMemo(() => {
    return piecework.reduce((sum, pw) => sum + pw.totalAmount, 0);
  }, [piecework]);

  const totalPayrollGross = useMemo(() => {
    return payrolls.reduce((sum, p) => sum + p.grossPay, 0);
  }, [payrolls]);

  // Filtered Rows for the Active View
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        e.fullName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        e.badgeNo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        e.position.toLowerCase().includes(searchFilter.toLowerCase());
      const matchDept = departmentFilter === "ALL" || e.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [employees, searchFilter, departmentFilter]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      const matchSearch =
        a.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        a.badgeNo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        a.date.includes(searchFilter);
      const matchDept = departmentFilter === "ALL" || a.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [attendance, searchFilter, departmentFilter]);

  const filteredPiecework = useMemo(() => {
    return piecework.filter((pw) => {
      const matchSearch =
        pw.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        pw.workOrderId.toLowerCase().includes(searchFilter.toLowerCase()) ||
        pw.operation.toLowerCase().includes(searchFilter.toLowerCase());
      const matchDept = departmentFilter === "ALL" || pw.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [piecework, searchFilter, departmentFilter]);

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      const matchSearch =
        p.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.badgeNo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.period.includes(searchFilter);
      const matchDept = departmentFilter === "ALL" || p.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [payrolls, searchFilter, departmentFilter]);

  const filteredDepartments = useMemo(() => {
    return departmentsList.filter((d) =>
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.code.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [departmentsList, searchFilter]);

  const filteredShifts = useMemo(() => {
    return shiftsList.filter((s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.code.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [shiftsList, searchFilter]);

  // Current Active Rows Count
  const currentRowsCount = useMemo(() => {
    if (activeView === "employees") return filteredEmployees.length;
    if (activeView === "attendance") return filteredAttendance.length;
    if (activeView === "piecework") return filteredPiecework.length;
    if (activeView === "payroll") return filteredPayrolls.length;
    if (activeView === "departments") return filteredDepartments.length;
    if (activeView === "shifts") return filteredShifts.length;
    return 0;
  }, [
    activeView,
    filteredEmployees,
    filteredAttendance,
    filteredPiecework,
    filteredPayrolls,
    filteredDepartments,
    filteredShifts,
  ]);

  // Sync with Global Status Bar
  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(currentRowsCount, selection.rows.length);
    }
  }, [currentRowsCount, selection.rows.length, updateGridStats]);

  // ── Column Definitions ──
  const columns: GridColumn[] = useMemo(() => {
    if (activeView === "employees") {
      return [
        { id: "badgeNo", title: "Tabel №", width: 95, icon: GridColumnIcon.HeaderString },
        { id: "fullName", title: "F.I.O. (Xodim)", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "position", title: "Lavozim", width: 180, icon: GridColumnIcon.HeaderString },
        { id: "department", title: "Sex / Bo'lim", width: 170, icon: GridColumnIcon.HeaderString },
        { id: "wageType", title: "Stavka turi", width: 110, icon: GridColumnIcon.HeaderString },
        { id: "baseSalary", title: "Asosiy Oklad (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "currentShift", title: "Biriktirilgan smena", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "phone", title: "Telefon", width: 130, icon: GridColumnIcon.HeaderString },
        { id: "hireDate", title: "Ishga kirgan", width: 105, icon: GridColumnIcon.HeaderDate },
        { id: "status", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
      ];
    } else if (activeView === "attendance") {
      return [
        { id: "date", title: "Sana", width: 100, icon: GridColumnIcon.HeaderDate },
        { id: "badgeNo", title: "Tabel №", width: 95, icon: GridColumnIcon.HeaderString },
        { id: "employeeName", title: "Xodim F.I.O.", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "department", title: "Sex / Bo'lim", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "shift", title: "Smena grafigi", width: 170, icon: GridColumnIcon.HeaderString },
        { id: "checkIn", title: "Kirish", width: 85, icon: GridColumnIcon.HeaderTime },
        { id: "checkOut", title: "Chiqish", width: 85, icon: GridColumnIcon.HeaderTime },
        { id: "workedHours", title: "Ish soati", width: 95, icon: GridColumnIcon.HeaderNumber },
        { id: "delayMinutes", title: "Kechikish (daq)", width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "notes", title: "Izoh / Sabab", width: 220, icon: GridColumnIcon.HeaderString },
      ];
    } else if (activeView === "piecework") {
      return [
        { id: "id", title: "Naryad ID", width: 90, icon: GridColumnIcon.HeaderString },
        { id: "date", title: "Sana", width: 95, icon: GridColumnIcon.HeaderDate },
        { id: "workOrderId", title: "Work Order", width: 110, icon: GridColumnIcon.HeaderString },
        { id: "employeeName", title: "Bajaruvchi usta", width: 190, icon: GridColumnIcon.HeaderString },
        { id: "machine", title: "Stanok / Uskuna", width: 150, icon: GridColumnIcon.HeaderString },
        { id: "operation", title: "Bajarilgan operatsiya", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "quantity", title: "Hajm", width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "unit", title: "Birligi", width: 75, icon: GridColumnIcon.HeaderString },
        { id: "rate", title: "Tarif (UZS)", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "totalAmount", title: "Summa (UZS)", width: 130, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "approvedBy", title: "Tasdiqladi", width: 160, icon: GridColumnIcon.HeaderString },
      ];
    } else if (activeView === "payroll") {
      return [
        { id: "period", title: "Davr (Oy)", width: 90, icon: GridColumnIcon.HeaderString },
        { id: "badgeNo", title: "Tabel №", width: 95, icon: GridColumnIcon.HeaderString },
        { id: "employeeName", title: "Xodim", width: 190, icon: GridColumnIcon.HeaderString },
        { id: "department", title: "Sex / Bo'lim", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "wageType", title: "Stavka", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "baseSalary", title: "Oklad (UZS)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "pieceworkAmount", title: "Ishbay summa (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "bonusAmount", title: "Bonus (UZS)", width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "grossPay", title: "Jami hisoblangan", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "totalDeductions", title: "Ushlanmalar", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "netPay", title: "Qo'lga tegadigan (Sof)", width: 150, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 105, icon: GridColumnIcon.HeaderString },
      ];
    } else if (activeView === "departments") {
      return [
        { id: "code", title: "Sex kodi", width: 110, icon: GridColumnIcon.HeaderString },
        { id: "name", title: "Sex / Bo'lim nomi", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "headPerson", title: "Sex boshlig'i", width: 180, icon: GridColumnIcon.HeaderString },
        { id: "phone", title: "Telefon", width: 140, icon: GridColumnIcon.HeaderString },
        { id: "staffCount", title: "Xodimlar soni", width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: "plant", title: "Filial", width: 180, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
      ];
    } else {
      // shifts
      return [
        { id: "code", title: "Smena kodi", width: 130, icon: GridColumnIcon.HeaderString },
        { id: "name", title: "Smena nomi", width: 240, icon: GridColumnIcon.HeaderString },
        { id: "startTime", title: "Boshlanishi", width: 100, icon: GridColumnIcon.HeaderTime },
        { id: "endTime", title: "Tugashi", width: 100, icon: GridColumnIcon.HeaderTime },
        { id: "type", title: "Rejim turi", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "activeWorkers", title: "Faol xodimlar", width: 120, icon: GridColumnIcon.HeaderNumber },
      ];
    }
  }, [activeView]);

  // ── Cell Value Formatter ──
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      if (!col) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

      let rowData: any;
      if (activeView === "employees") rowData = filteredEmployees[rowIndex];
      else if (activeView === "attendance") rowData = filteredAttendance[rowIndex];
      else if (activeView === "piecework") rowData = filteredPiecework[rowIndex];
      else if (activeView === "payroll") rowData = filteredPayrolls[rowIndex];
      else if (activeView === "departments") rowData = filteredDepartments[rowIndex];
      else rowData = filteredShifts[rowIndex];

      if (!rowData) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const rawVal = col?.id ? rowData[col.id] : "";

      // Number formatting in currency
      if (
        col.id === "baseSalary" ||
        col.id === "pieceworkAmount" ||
        col.id === "bonusAmount" ||
        col.id === "grossPay" ||
        col.id === "totalDeductions" ||
        col.id === "netPay" ||
        col.id === "totalAmount"
      ) {
        const num = Number(rawVal) || 0;
        return {
          kind: GridCellKind.Text,
          data: String(num),
          displayData: `${num.toLocaleString("uz-UZ")} UZS`,
          allowOverlay: true,
          themeOverride:
            col.id === "netPay" || col.id === "totalAmount"
              ? { textDark: "#10b981", baseFontStyle: "bold 12px monospace" }
              : { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "quantity" || col.id === "rate" || col.id === "workedHours") {
        const num = Number(rawVal) || 0;
        return {
          kind: GridCellKind.Text,
          data: String(num),
          displayData: num.toLocaleString("uz-UZ"),
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      // Status badges
      if (col.id === "status") {
        return {
          kind: GridCellKind.Text,
          data: String(rawVal || ""),
          displayData: String(rawVal || ""),
          allowOverlay: false,
          themeOverride: {
            textDark:
              rawVal === "Active" || rawVal === "Present" || rawVal === "Approved" || rawVal === "Paid"
                ? "#059669"
                : rawVal === "Late" || rawVal === "Verified" || rawVal === "Calculated"
                ? "#d97706"
                : "#dc2626",
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      // Codes and Keys (Monospace)
      if (col.id === "badgeNo" || col.id === "workOrderId" || col.id === "id" || col.id === "code") {
        return {
          kind: GridCellKind.Text,
          data: String(rawVal || ""),
          displayData: String(rawVal || ""),
          allowOverlay: true,
          themeOverride: {
            textDark: "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        data: String(rawVal ?? ""),
        displayData: String(rawVal ?? ""),
        allowOverlay: true,
      };
    },
    [
      columns,
      activeView,
      filteredEmployees,
      filteredAttendance,
      filteredPiecework,
      filteredPayrolls,
      filteredDepartments,
      filteredShifts,
    ]
  );

  // ── Open Document on Double Click ──
  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;

      if (activeView === "employees") {
        const emp = filteredEmployees[rowIndex];
        if (emp) {
          openTab({
            id: `emp-${emp.id}`,
            title: `${emp.fullName} (${emp.badgeNo})`,
            type: "employee-detail",
            module: "hr",
            documentData: emp,
          });
        }
      } else if (activeView === "piecework") {
        const pw = filteredPiecework[rowIndex];
        if (pw) {
          // Open associated employee or work order
          openTab({
            id: `emp-${pw.employeeId}`,
            title: `${pw.employeeName} (${pw.badgeNo})`,
            type: "employee-detail",
            module: "hr",
            documentData: { id: pw.employeeId, fullName: pw.employeeName, badgeNo: pw.badgeNo },
            activeLevel3Tab: "piecework",
          });
        }
      } else if (activeView === "attendance") {
        const att = filteredAttendance[rowIndex];
        if (att) {
          openTab({
            id: `emp-${att.employeeId}`,
            title: `${att.employeeName} (${att.badgeNo})`,
            type: "employee-detail",
            module: "hr",
            documentData: { id: att.employeeId, fullName: att.employeeName, badgeNo: att.badgeNo },
            activeLevel3Tab: "attendance",
          });
        }
      }
    },
    [activeView, filteredEmployees, filteredPiecework, filteredAttendance, openTab]
  );

  // ── Handle Creating a New Employee ──
  const handleCreateEmployee = () => {
    if (!newFullName.trim()) return;
    const badge = newBadgeNo.trim() || `EMP-0${employees.length + 101}`;
    const newEmp: EmployeeRecord = {
      id: `emp-${Date.now()}`,
      badgeNo: badge,
      fullName: newFullName.trim(),
      department: newDepartment,
      departmentCode: "DEP-" + newDepartment.slice(0, 4).toUpperCase(),
      position: newPosition,
      plant: "PrintGoo Bosh Zavod",
      phone: newPhone,
      hireDate: new Date().toISOString().split("T")[0],
      status: "Active",
      wageType: newWageType,
      baseSalary: Number(newBaseSalary) || 0,
      pieceworkRateMultiplier: 1.0,
      hourlyRate: 30000,
      currentShift: "Smena A (08:00 - 20:00)",
      skills: ["Bosma uskunalari"],
    };
    upsertEmployee(newEmp);
    setIsAddEmployeeOpen(false);
    // Reset form
    setNewFullName("");
    setNewBadgeNo("");
    // Open new employee tab
    openTab({
      id: `emp-${newEmp.id}`,
      title: `${newEmp.fullName} (${newEmp.badgeNo})`,
      type: "employee-detail",
      module: "hr",
      documentData: newEmp,
    });
  };

  // ── Handle Adding a Piecework Record ──
  const handleCreatePiecework = () => {
    const selectedEmp = employees.find((e) => e.id === pwEmployeeId) || employees[0];
    if (!selectedEmp) return;
    const qty = Number(pwQuantity) || 0;
    const rate = Number(pwRate) || 0;
    const total = qty * rate * selectedEmp.pieceworkRateMultiplier;

    const newPw: PieceworkRecord = {
      id: `pw-0${piecework.length + 1}`,
      date: new Date().toISOString().split("T")[0],
      workOrderId: pwWorkOrderId,
      employeeId: selectedEmp.id,
      badgeNo: selectedEmp.badgeNo,
      employeeName: selectedEmp.fullName,
      department: selectedEmp.department,
      machine: pwMachine,
      operation: pwOperation,
      quantity: qty,
      unit: pwUnit,
      rate: rate,
      totalAmount: Math.round(total),
      status: "Verified",
      approvedBy: "Sex Masteri",
    };
    upsertPiecework(newPw);
    setIsAddPieceworkOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── Top Industrial Toolbar & KPI Cards ── */}
      <div className="border-b bg-card p-3 space-y-3">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded border bg-muted/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Jami xodimlar shtati</div>
              <div className="text-base font-bold font-mono text-foreground flex items-center gap-1.5 mt-0.5">
                <Users className="size-4 text-blue-600" />
                {totalEmployeesCount}{" "}
                <span className="text-[11px] font-normal text-emerald-600 font-sans">
                  ({activeEmployeesCount} faol)
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded border bg-muted/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Bugun smenada (T-13)</div>
              <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <CalendarClock className="size-4 text-emerald-600" />
                {todayPresentCount}{" "}
                <span className="text-[11px] font-normal text-amber-600 font-sans">
                  ({todayLateCount} kechikkan)
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded border bg-muted/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Ishbay ishlab chiqarish</div>
              <div className="text-sm font-bold font-mono text-primary flex items-center gap-1 mt-0.5">
                <Award className="size-4 text-primary" />
                {totalPieceworkSum.toLocaleString("uz-UZ")} UZS
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded border bg-muted/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Oylik maosh fondi (FOT)</div>
              <div className="text-sm font-bold font-mono text-foreground flex items-center gap-1 mt-0.5">
                <Calculator className="size-4 text-purple-600" />
                {totalPayrollGross.toLocaleString("uz-UZ")} UZS
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* HR Subview Switchers */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border text-xs">
            <button
              onClick={() => setActiveView("employees")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "employees"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="size-3.5 text-blue-600" />
              Xodimlar ({employees.length})
            </button>

            <button
              onClick={() => setActiveView("attendance")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "attendance"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarClock className="size-3.5 text-emerald-600" />
              Tabel T-13 ({attendance.length})
            </button>

            <button
              onClick={() => setActiveView("piecework")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "piecework"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award className="size-3.5 text-amber-600" />
              Ishbay (Sdelka) ({piecework.length})
            </button>

            <button
              onClick={() => setActiveView("payroll")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "payroll"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calculator className="size-3.5 text-violet-600" />
              Ish haqi hisobi ({payrolls.length})
            </button>

            <button
              onClick={() => setActiveView("departments")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "departments"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="size-3.5 text-zinc-500" />
              Sexlar ({departmentsList.length})
            </button>

            <button
              onClick={() => setActiveView("shifts")}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeView === "shifts"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="size-3.5 text-zinc-500" />
              Smenalar ({shiftsList.length})
            </button>
          </div>

          {/* Search, Filter & Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="F.I.O., tabel № yoki kasb..."
                className="h-7 pl-8 text-xs font-sans"
              />
            </div>

            <Select
              value={departmentFilter}
              onValueChange={(val) => {
                if (val) setDepartmentFilter(val);
              }}
            >
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue placeholder="Barcha sexlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha sexlar</SelectItem>
                <SelectItem value="Flekso bosma sexi">Flekso bosma sexi</SelectItem>
                <SelectItem value="Tikuvchilik va lenta sexi">Tikuvchilik sexi</SelectItem>
                <SelectItem value="Kesish va qadoqlash sexi">Kesish va qadoqlash</SelectItem>
                <SelectItem value="Prepress va dizayn">Prepress markazi</SelectItem>
                <SelectItem value="Sifat nazorati (OTK)">Sifat nazorati (OTK)</SelectItem>
              </SelectContent>
            </Select>

            {activeView === "employees" && (
              <Button
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 font-medium"
                onClick={() => setIsAddEmployeeOpen(true)}
              >
                <Plus className="size-3.5" />
                Yangi xodim (Ins)
              </Button>
            )}

            {activeView === "piecework" && (
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-medium"
                onClick={() => {
                  setPwEmployeeId(employees[0]?.id || "");
                  setIsAddPieceworkOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Ishbay naryad kiritish
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Chop etish
            </Button>
          </div>
        </div>
      </div>

      {/* ── High-Performance Canvas Data Grid ── */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <div className="absolute inset-0">
            <DataEditor
              width="100%"
              height="100%"
              columns={columns}
              rows={currentRowsCount}
              getCellContent={getCellContent}
              rowMarkers="both"
              freezeColumns={1}
              headerHeight={28}
              rowHeight={27}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={handleCellActivated}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              smoothScrollX
              smoothScrollY
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              handleCellActivated([0, selectedRow]);
            }}
          >
            <ExternalLink className="size-3.5 mr-2" />
            Kartochkani ochish (F12)
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setIsAddEmployeeOpen(true)}>
            <Plus className="size-3.5 mr-2" />
            Yangi xodim qo'shish (Ins)
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => window.print()}>
            <Printer className="size-3.5 mr-2" />
            T-13 / Hisob varaqasini chop etish
          </ContextMenuItem>
          <ContextMenuItem onClick={() => alert("CSV faylga yuklab olindi.")}>
            <Download className="size-3.5 mr-2" />
            Excel (.xlsx) formatida eksport
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* ── Dialog 1: Add New Employee ── */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-primary" />
              Yangi xodimni ro'yxatga olish (Ishga qabul qilish)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kadrlar hisobi va mehnat shartnomasi parametrlarini kiriting
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">Tabel raqami</Label>
              <Input
                placeholder="EMP-0105"
                value={newBadgeNo}
                onChange={(e) => setNewBadgeNo(e.target.value)}
                className="h-8 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs">To'liq F.I.O. *</Label>
              <Input
                placeholder="Rustam Rahimov"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="h-8"
              />
            </div>

            <div>
              <Label className="text-xs">Sex / Bo'lim</Label>
              <Select
                value={newDepartment}
                onValueChange={(val) => {
                  if (val) setNewDepartment(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
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
              <Label className="text-xs">Lavozim</Label>
              <Input
                placeholder="Pechatnik yordamchisi"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="h-8"
              />
            </div>

            <div>
              <Label className="text-xs">Stavka turi</Label>
              <Select
                value={newWageType}
                onValueChange={(val) => {
                  if (val) setNewWageType(val as any);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Piecework">Ishbay (Sdelka)</SelectItem>
                  <SelectItem value="Mixed">Aralash (Oklad + Sdelka)</SelectItem>
                  <SelectItem value="Salary">Oklad (Sobit)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Asosiy oklad (UZS)</Label>
              <Input
                type="number"
                value={newBaseSalary}
                onChange={(e) => setNewBaseSalary(e.target.value)}
                className="h-8 font-mono"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Telefon raqami</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="h-8 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddEmployeeOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleCreateEmployee}
              className="h-8 text-xs bg-primary text-primary-foreground"
            >
              Qabul qilish va kartochkani ochish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Add New Piecework Log ── */}
      <Dialog open={isAddPieceworkOpen} onOpenChange={setIsAddPieceworkOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="size-4 text-emerald-600" />
              Ishbay naryad qayd etish (Сдельный наряд)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ishlab chiqarish buyurtmasi (Work Order) bo'yicha ustaga ishbay maosh hisoblash
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">Work Order № *</Label>
              <Input
                value={pwWorkOrderId}
                onChange={(e) => setPwWorkOrderId(e.target.value)}
                className="h-8 font-mono font-bold text-primary"
              />
            </div>

            <div>
              <Label className="text-xs">Bajaruvchi xodim *</Label>
              <Select
                value={pwEmployeeId}
                onValueChange={(val) => {
                  if (val) setPwEmployeeId(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Xodimni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName} ({e.badgeNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Stanok / Mashina</Label>
              <Input
                value={pwMachine}
                onChange={(e) => setPwMachine(e.target.value)}
                className="h-8"
              />
            </div>

            <div>
              <Label className="text-xs">Birlik tarifi (UZS)</Label>
              <Input
                type="number"
                step="0.1"
                value={pwRate}
                onChange={(e) => setPwRate(e.target.value)}
                className="h-8 font-mono"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Bajarilgan texnologik operatsiya</Label>
              <Input
                value={pwOperation}
                onChange={(e) => setPwOperation(e.target.value)}
                className="h-8"
              />
            </div>

            <div>
              <Label className="text-xs">Bajarilgan hajm</Label>
              <Input
                type="number"
                value={pwQuantity}
                onChange={(e) => setPwQuantity(e.target.value)}
                className="h-8 font-mono font-bold"
              />
            </div>

            <div>
              <Label className="text-xs">O'lchov birligi</Label>
              <Select
                value={pwUnit}
                onValueChange={(val) => {
                  if (val) setPwUnit(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dona">dona (pcs)</SelectItem>
                  <SelectItem value="metr">metr (pogonametr)</SelectItem>
                  <SelectItem value="otpechatok">otpechatok (bosish)</SelectItem>
                  <SelectItem value="rulon">rulon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 p-2.5 rounded bg-muted/30 border flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Hisoblangan jami ish haqi:</span>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {(
                  (Number(pwQuantity) || 0) * (Number(pwRate) || 0)
                ).toLocaleString("uz-UZ")}{" "}
                UZS
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddPieceworkOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleCreatePiecework}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Naryadni tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
