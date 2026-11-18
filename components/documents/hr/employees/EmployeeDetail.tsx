"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import {
  EmployeeRecord,
  EmployeeHistoryItem,
  PieceworkRecord,
  AttendanceRecord,
} from "../types";
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

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((m) => m.DataEditor),
  { ssr: false }
);

const DEFAULT_PIECEWORK_COLUMNS: GridColumn[] = [
  { id: "workDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
  { id: "workOrderId", title: "Buyurtma №", width: 130, icon: GridColumnIcon.HeaderString },
  { id: "machine", title: "Stanok / Uskuna", width: 145, icon: GridColumnIcon.HeaderString },
  { id: "operationName", title: "Bajarilgan operatsiya", width: 220, icon: GridColumnIcon.HeaderString },
  { id: "quantity", title: "Bajarilgan hajm", width: 125, icon: GridColumnIcon.HeaderNumber },
  { id: "rate", title: "Tarif (UZS)", width: 100, icon: GridColumnIcon.HeaderNumber },
  { id: "totalAmount", title: "Summa (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
  { id: "status", title: "Holati", width: 110, icon: GridColumnIcon.HeaderString },
  { id: "approvedBy", title: "Tasdiqladi", width: 150, icon: GridColumnIcon.HeaderString },
  { id: "notes", title: "Izoh", width: 180, icon: GridColumnIcon.HeaderString },
];

const DEFAULT_ATTENDANCE_COLUMNS: GridColumn[] = [
  { id: "workDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
  { id: "shiftType", title: "Smena", width: 140, icon: GridColumnIcon.HeaderString },
  { id: "checkIn", title: "Kirish", width: 90, icon: GridColumnIcon.HeaderTime },
  { id: "checkOut", title: "Chiqish", width: 90, icon: GridColumnIcon.HeaderTime },
  { id: "workedHours", title: "Ish soati", width: 105, icon: GridColumnIcon.HeaderNumber },
  { id: "delayMinutes", title: "Kechikish", width: 110, icon: GridColumnIcon.HeaderNumber },
  { id: "status", title: "Holati", width: 110, icon: GridColumnIcon.HeaderString },
  { id: "sourceDevice", title: "Qurilma / Manba", width: 170, icon: GridColumnIcon.HeaderString },
  { id: "notes", title: "Izoh", width: 200, icon: GridColumnIcon.HeaderString },
];
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
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ComboboxSelect, type ComboboxOption } from "@/components/ui/combobox";
import { generateNextCode } from "@/lib/utils";
import { OrgUnitSelect } from "@/components/common/OrgUnitSelect";
import { EmployeeLedgerPanel } from "../advances/EmployeeLedgerPanel";
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
  ShieldCheck,
  Fingerprint,
  CheckCircle2,
  History,
  UserX,
  UserCheck,
  X,
  Plus,
  Loader2,
  Camera,
  Upload,
  UploadCloud,
  Trash2,
  KeyRound,
  Wallet,
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

type NormalizedStatus = "active" | "probation" | "on_leave" | "terminated";
type NormalizedWage = "salary" | "piecework" | "hourly" | "mixed";

// The API has historically returned both "Active" and "active" style values.
function normalizeStatus(s?: string | null): NormalizedStatus {
  const v = String(s || "active").toLowerCase().replace(/\s+/g, "_");
  if (v === "onleave" || v === "on_leave") return "on_leave";
  if (v === "probation" || v === "terminated") return v;
  return "active";
}

function normalizeWage(w?: string | null): NormalizedWage {
  const v = String(w || "piecework").toLowerCase();
  return v === "salary" || v === "hourly" || v === "mixed" ? v : "piecework";
}

const STATUS_LABELS: Record<NormalizedStatus, string> = {
  active: "Faol",
  probation: "Sinovda",
  on_leave: "Ta'tilda",
  terminated: "Bo'shatilgan",
};

const WAGE_LABELS: Record<NormalizedWage, string> = {
  piecework: "Ishbay",
  salary: "Oklad",
  hourly: "Soatbay",
  mixed: "Aralash",
};

const SHIFT_LABELS: Record<string, string> = {
  day: "Kunduzgi (08:00–20:00)",
  night: "Tungi (20:00–08:00)",
  daily: "Ofis (09:00–18:00)",
};

const HISTORY_TYPE_LABELS: Record<string, string> = {
  position_change: "Lavozim",
  salary_change: "Oklad",
  department_change: "Bo'lim",
  status_change: "Holat",
};

const fmtMoney = (n: unknown) => `${Number(n || 0).toLocaleString("uz-UZ")} UZS`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep stored photos small: a 3x4 portrait at 600x800 is plenty for the card and Face ID.
function resizeImage(file: File, maxW = 600, maxH = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas mavjud emas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label className="text-[11px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <div className="text-[10px] leading-tight text-destructive">{error}</div>}
    </div>
  );
}

const errCls = (e?: string) => (e ? "border-destructive focus-visible:ring-destructive/30" : "");

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
    positionsList,
    setDepartmentsList,
    setPositionsList,
    plants,
    fetchPlants,
    openTab,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

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
    const nextBadge = generateNextCode("EMP", employees.map((e) => e.badgeNumber || e.badgeNo), 4);
    return {
      id: empId,
      badgeNumber: nextBadge,
      badgeNo: nextBadge,
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
  const [syncingBiometric, setSyncingBiometric] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);
  // Shop-floor kiosk PIN: only whether one is set comes back, never the PIN.
  const [hasTerminalPin, setHasTerminalPin] = useState(false);
  const [terminalPin, setTerminalPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const employeeDbId = !isNewRecord ? formData.id : "";
  useEffect(() => {
    if (!employeeDbId) return;
    let cancelled = false;
    fetch(`/api/v1/hr/employees/${employeeDbId}/terminal-pin`)
      .then((r) => r.json())
      .then((j) => !cancelled && j.success && setHasTerminalPin(Boolean(j.hasPin)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [employeeDbId]);

  const saveTerminalPin = async (pin: string | null) => {
    if (!employeeDbId) return;
    setSavingPin(true);
    try {
      const res = await fetch(`/api/v1/hr/employees/${employeeDbId}/terminal-pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        addNotification({ title: "PIN saqlanmadi", description: json.error, severity: "error" });
        return;
      }
      setHasTerminalPin(Boolean(json.hasPin));
      setTerminalPin("");
      addNotification({ title: json.hasPin ? "PIN o'rnatildi" : "PIN o'chirildi", description: formData.fullName, severity: "success" });
    } finally {
      setSavingPin(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch full details from API if ID is valid UUID and not draft
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
    }
  }, [empId, isInitialNew]);

  // History reloads after each save so the tab never shows a stale list.
  useEffect(() => {
    if (!employeeDbId || employeeDbId.length <= 20) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/v1/hr/employees/${employeeDbId}/history`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.success && Array.isArray(res.data)) setHistoryList(res.data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employeeDbId, historyVersion]);

  // Load departments and positions from database
  useEffect(() => {
    fetch("/api/v1/hr/departments")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setDepartmentsList(res.data);
        }
      })
      .catch(() => {});

    fetch("/api/v1/hr/positions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPositionsList(res.data);
        }
      })
      .catch(() => {});
    // Load plants if empty
    if (plants.length === 0 && fetchPlants) {
      fetchPlants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // API load for employee's piecework and attendance
  const [apiPieceworks, setApiPieceworks] = useState<PieceworkRecord[] | null>(null);
  const [apiAttendance, setApiAttendance] = useState<AttendanceRecord[] | null>(null);

  useEffect(() => {
    const id = formData.id || empId;
    if (id && id.length > 20 && !id.startsWith("emp-new")) {
      fetch(`/api/v1/hr/piecework?employeeId=${id}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setApiPieceworks(res.data);
          }
        })
        .catch(() => {});

      fetch(`/api/v1/hr/attendance?employeeId=${id}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setApiAttendance(res.data);
          }
        })
        .catch(() => {});
    }
  }, [formData.id, empId]);

  // Filter piecework and attendance for this employee (with fallback to store)
  // Without a badge, "undefined === undefined" would pull in every unbadged row.
  const myBadge = formData.badgeNumber || formData.badgeNo || "";
  const employeePieceworks = useMemo(() => {
    if (apiPieceworks && apiPieceworks.length > 0) return apiPieceworks;
    return (piecework || []).filter(
      (pw) =>
        (formData.id && pw.employeeId === formData.id) ||
        (myBadge && (pw.badgeNumber || pw.badgeNo) === myBadge)
    );
  }, [apiPieceworks, piecework, formData.id, myBadge]);

  const totalPieceworkEarned = useMemo(() => {
    return employeePieceworks.reduce((sum, pw) => sum + Number(pw.totalAmount || 0), 0);
  }, [employeePieceworks]);

  const employeeAttendance = useMemo(() => {
    if (apiAttendance && apiAttendance.length > 0) return apiAttendance;
    return (attendance || []).filter(
      (att) =>
        (formData.id && att.employeeId === formData.id) ||
        (myBadge && (att.badgeNumber || att.badgeNo) === myBadge)
    );
  }, [apiAttendance, attendance, formData.id, myBadge]);

  // Rounded to avoid "37.300000000000004 soat" from float sums.
  const totalHoursWorked = useMemo(() => {
    const sum = employeeAttendance.reduce((s, att) => s + Number(att.workedHours || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [employeeAttendance]);

  const lateCount = useMemo(
    () => employeeAttendance.filter((a) => (a.delayMinutes || 0) > 0 || a.status === "late").length,
    [employeeAttendance]
  );

  // Glide Data Grid states & handlers for Piecework
  const [pwCols, setPwCols] = useState<GridColumn[]>(DEFAULT_PIECEWORK_COLUMNS);
  const [pwSelection, setPwSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const handlePieceworkColumnResize = useCallback((col: GridColumn, newSize: number) => {
    setPwCols((prev) => prev.map((c) => (c.id === col.id ? { ...c, width: newSize } : c)));
  }, []);

  const handlePieceworkActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const pw = employeePieceworks[rowIndex];
      if (pw?.workOrderId && openTab) {
        openTab({
          id: pw.workOrderId,
          type: "work-order",
          title: `WO-${pw.workOrderId}`,
          module: "production",
          isUnsaved: false,
          documentData: { id: pw.workOrderId },
        });
      }
    },
    [employeePieceworks, openTab]
  );

  const getPieceworkCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = pwCols[colIndex];
      const row = employeePieceworks[rowIndex];

      if (!col || !col.id || !row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (col.id === "workDate") {
        const d = row.workDate || row.date || "";
        return {
          kind: GridCellKind.Text,
          data: d,
          displayData: d,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "workOrderId") {
        return {
          kind: GridCellKind.Text,
          data: row.workOrderId,
          displayData: row.workOrderId,
          allowOverlay: false,
          themeOverride: { textDark: "#2563eb", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "machine") {
        const m = row.machineCode || row.machine || "—";
        return { kind: GridCellKind.Text, data: m, displayData: m, allowOverlay: false };
      }

      if (col.id === "operationName") {
        const op = row.operationName || row.operation || "—";
        return { kind: GridCellKind.Text, data: op, displayData: op, allowOverlay: false };
      }

      if (col.id === "quantity") {
        const q = Number(row.completedQuantity ?? row.quantity ?? 0);
        const u = row.unit || "dona";
        return {
          kind: GridCellKind.Text,
          data: String(q),
          displayData: `${q.toLocaleString("uz-UZ")} ${u}`,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "rate") {
        const r = Number(row.pieceRate ?? row.rate ?? 0);
        return {
          kind: GridCellKind.Text,
          data: String(r),
          displayData: r.toLocaleString("uz-UZ"),
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "totalAmount") {
        return {
          kind: GridCellKind.Text,
          data: String(row.totalAmount),
          displayData: fmtMoney(row.totalAmount),
          allowOverlay: false,
          themeOverride: { textDark: "#059669", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "status") {
        const raw = String(row.status || "").toLowerCase();
        let label = String(row.status || "—");
        let color = "#2563eb";
        if (raw === "approved") {
          label = "Tasdiqlangan";
          color = "#059669";
        } else if (raw === "verified") {
          label = "Tekshirilgan";
          color = "#0284c7";
        } else if (raw === "paid") {
          label = "To'langan";
          color = "#16a34a";
        } else if (raw === "draft") {
          label = "Qoralama";
          color = "#6b7280";
        }
        return {
          kind: GridCellKind.Text,
          data: String(row.status || ""),
          displayData: label,
          allowOverlay: false,
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (col.id === "approvedBy") {
        const a = row.approvedBy || "—";
        return { kind: GridCellKind.Text, data: a, displayData: a, allowOverlay: false };
      }

      if (col.id === "notes") {
        const n = row.notes || "—";
        return { kind: GridCellKind.Text, data: n, displayData: n, allowOverlay: false };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [pwCols, employeePieceworks]
  );

  // Glide Data Grid states & handlers for Attendance
  const [attCols, setAttCols] = useState<GridColumn[]>(DEFAULT_ATTENDANCE_COLUMNS);
  const [attSelection, setAttSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const handleAttendanceColumnResize = useCallback((col: GridColumn, newSize: number) => {
    setAttCols((prev) => prev.map((c) => (c.id === col.id ? { ...c, width: newSize } : c)));
  }, []);

  const getAttendanceCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = attCols[colIndex];
      const row = employeeAttendance[rowIndex];

      if (!col || !col.id || !row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (col.id === "workDate") {
        const d = row.workDate || row.date || "";
        return {
          kind: GridCellKind.Text,
          data: d,
          displayData: d,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "shiftType") {
        const s = row.shiftType || row.shift || "—";
        return { kind: GridCellKind.Text, data: s, displayData: s, allowOverlay: false };
      }

      if (col.id === "checkIn") {
        const t = row.checkIn || "—";
        return {
          kind: GridCellKind.Text,
          data: t,
          displayData: t,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "checkOut") {
        const t = row.checkOut || "—";
        return {
          kind: GridCellKind.Text,
          data: t,
          displayData: t,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "workedHours") {
        return {
          kind: GridCellKind.Text,
          data: String(row.workedHours),
          displayData: `${row.workedHours} soat`,
          allowOverlay: false,
          themeOverride: { baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "delayMinutes") {
        const d = row.delayMinutes || 0;
        return {
          kind: GridCellKind.Text,
          data: String(d),
          displayData: d > 0 ? `+${d} daq` : "—",
          allowOverlay: false,
          themeOverride: {
            textDark: d > 0 ? "#dc2626" : "#6b7280",
            baseFontStyle: d > 0 ? "bold 11px monospace" : "11px monospace",
          },
        };
      }

      if (col.id === "status") {
        const raw = String(row.status || "").toLowerCase();
        let label = String(row.status || "—");
        let color = "#6b7280";
        if (raw === "present") {
          label = "Kelgan";
          color = "#059669";
        } else if (raw === "late") {
          label = "Kechikkan";
          color = "#d97706";
        } else if (raw === "absent") {
          label = "Kelmagan";
          color = "#dc2626";
        } else if (raw === "sick_leave" || raw === "onleave" || raw === "vacation" || raw === "day_off") {
          label = "Ta'tilda / Kasallik";
          color = "#2563eb";
        }
        return {
          kind: GridCellKind.Text,
          data: String(row.status || ""),
          displayData: label,
          allowOverlay: false,
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (col.id === "sourceDevice") {
        const dev = row.sourceDevice || "—";
        return { kind: GridCellKind.Text, data: dev, displayData: dev, allowOverlay: false };
      }

      if (col.id === "notes") {
        const n = row.notes || "—";
        return { kind: GridCellKind.Text, data: n, displayData: n, allowOverlay: false };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [attCols, employeeAttendance]
  );

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

    if (file.size > 10 * 1024 * 1024) {
      addNotification({
        title: "Xatolik",
        description: "Fayl hajmi 10MB dan oshmasligi kerak.",
        severity: "error",
      });
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    resizeImage(file)
      .then((dataUrl) => handleUpdate({ avatarUrl: dataUrl }))
      .catch((err: Error) =>
        addNotification({ title: "Xatolik", description: err.message, severity: "error" })
      );
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleUpdate({ avatarUrl: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSyncToTerminals = async () => {
    if (!formData.id || isNewRecord) {
      addNotification({
        title: "Ogohlantirish",
        description: "Terminallarga yuklashdan oldin xodimni saqlang.",
        severity: "warning",
      });
      return;
    }

    if (!formData.avatarUrl) {
      addNotification({
        title: "Fotosurat kerak",
        description: "Face ID uchun avval 3x4 fotosurat yuklang.",
        severity: "error",
      });
      return;
    }

    setSyncingBiometric(true);
    try {
      const res = await fetch(`/api/v1/hr/employees/${formData.id}/sync-biometric`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        const count = json.results?.length || 0;
        addNotification({
          title: "Face ID yuklandi",
          description: `${formData.fullName} ma'lumotlari ${count} ta faol terminalga yuborildi.`,
          severity: "success",
        });
      } else {
        throw new Error(json.error || "Terminallarga yuklashda xatolik");
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message,
        severity: "error",
      });
    } finally {
      setSyncingBiometric(false);
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

  const departmentOptions = useMemo<ComboboxOption[]>(() => {
    const list = departmentsList || [];
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];

    list.forEach((d) => {
      if (d.name && !seen.has(d.name)) {
        seen.add(d.name);
        result.push({
          value: d.name,
          label: d.name,
          description: d.code ? `Kodi: ${d.code}${d.plant ? ` • ${d.plant}` : ""}` : (d.plant ? `Filial: ${d.plant}` : undefined),
        });
      }
    });

    const current = formData.departmentName || formData.department;
    if (current && !seen.has(current)) {
      result.push({ value: current, label: current });
    }

    return result;
  }, [departmentsList, formData.departmentName, formData.department]);

  const positionOptions = useMemo<ComboboxOption[]>(() => {
    const list = positionsList || [];
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];

    list.forEach((p) => {
      if (p.title && !seen.has(p.title)) {
        seen.add(p.title);
        result.push({
          value: p.title,
          label: p.title,
          description: p.departmentName ? `Bo'lim: ${p.departmentName}` : (p.code ? `Kodi: ${p.code}` : undefined),
        });
      }
    });

    const current = formData.positionTitle || formData.position;
    if (current && !seen.has(current)) {
      result.push({ value: current, label: current });
    }

    return result;
  }, [positionsList, formData.positionTitle, formData.position]);

  const plantOptions = useMemo<ComboboxOption[]>(() => {
    const list = plants || [];
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];

    list.forEach((p) => {
      if (p.name && !seen.has(p.name)) {
        seen.add(p.name);
        result.push({
          value: p.name,
          label: p.name,
          description: p.code ? `Kodi: ${p.code}${p.branchType ? ` • ${p.branchType}` : ""}` : (p.branchType || undefined),
        });
      }
    });

    const current = formData.plant;
    if (current && !seen.has(current)) {
      result.push({ value: current, label: current });
    }

    return result;
  }, [plants, formData.plant]);

  // `overrides` lets actions like status toggles save a value in the same click,
  // without waiting for setFormData to land.
  const handleSave = async (shouldClose = false, overrides: Partial<EmployeeRecord> = {}) => {
    if (saving) return false;
    const data: EmployeeRecord = { ...formData, ...overrides };
    const lName = data.lastName?.trim() || "";
    const fName = data.firstName?.trim() || "";
    const mName = data.middleName?.trim() || "";
    const dept = data.departmentName?.trim() || data.department?.trim() || "";
    const pos = data.positionTitle?.trim() || data.position?.trim() || "";
    const phone = data.phone?.trim() || "";
    const email = data.email?.trim() || "";
    const hireDate = data.hireDate?.trim() || "";
    const badge = data.badgeNumber?.trim() || data.badgeNo?.trim() || "";
    const wage = normalizeWage(data.wageType);
    const pinfl = (data.pinfl || "").trim();

    const computedFullName =
      [lName, fName, mName].filter(Boolean).join(" ").trim() || data.fullName?.trim() || "";

    const newErrors: Record<string, string> = {};
    if (!badge) newErrors.badgeNumber = "Tabel raqamini kiriting";
    if (!lName) newErrors.lastName = "Familiyani kiriting";
    if (!fName) newErrors.firstName = "Ismni kiriting";
    if (!dept) newErrors.departmentName = "Bo'limni tanlang";
    if (!pos) newErrors.positionTitle = "Lavozimni tanlang";
    if (phone.replace(/\D/g, "").length < 7) newErrors.phone = "Telefon raqami to'liq emas";
    if (email && !EMAIL_RE.test(email)) newErrors.email = "Pochta manzili noto'g'ri";
    if (!hireDate) newErrors.hireDate = "Sanani tanlang";
    if (pinfl && !/^\d{14}$/.test(pinfl)) newErrors.pinfl = "14 ta raqam bo'lishi kerak";
    // Rates only matter while the person is paid; terminating must never be blocked by them.
    if (normalizeStatus(data.status) !== "terminated") {
      if ((wage === "salary" || wage === "mixed") && !(Number(data.baseSalary) > 0)) {
        newErrors.baseSalary = "Okladni kiriting";
      }
      if (wage === "hourly" && !(Number(data.hourlyRate) > 0)) {
        newErrors.hourlyRate = "Stavkani kiriting";
      }
      const mult = Number(data.pieceworkMultiplier ?? data.pieceworkRateMultiplier ?? 1);
      if ((wage === "piecework" || wage === "mixed") && !(mult > 0)) {
        newErrors.pieceworkMultiplier = "0 dan katta bo'lsin";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const onWageTab = ["baseSalary", "hourlyRate", "pieceworkMultiplier"];
      const firstKey = Object.keys(newErrors)[0];
      setActiveTab(onWageTab.includes(firstKey) ? "wage" : "overview");
      addNotification({
        title: "Maydonlar to'ldirilmadi",
        description: Object.values(newErrors).join(", "),
        severity: "error",
      });
      return false;
    }

    setErrors({});
    setSaving(true);
    let currentId = data.id;

    try {
      const payload: Partial<EmployeeRecord> = {
        ...data,
        firstName: fName,
        lastName: lName,
        middleName: mName || null,
        fullName: computedFullName,
        email: email || null,
        avatarUrl: data.avatarUrl || null,
        badgeNumber: badge,
        badgeNo: badge,
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
          ...data,
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
        if (data.id && data.id.length > 20) {
          const res = await fetch(`/api/v1/hr/employees/${data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || "Xodimni yangilashda xatolik yuz berdi");
          }
        }
        const updatedRecord = { ...data, ...payload };
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

      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setIsSaved(false), 2500);
      setHistoryVersion((v) => v + 1);

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
    void handleSave(true);
  };

  // Status change is saved right away: before, the button only flipped local state
  // and announced "bo'shatildi" even though nothing reached the server.
  const handleToggleStatus = async (newStatus: "active" | "terminated") => {
    setConfirmTerminate(false);
    await handleSave(false, { status: newStatus });
  };

  // Ctrl+S / Cmd+S saves the card.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      const root = rootRef.current;
      // Only the visible tab reacts; hidden workspace tabs have no layout box.
      if (!root || root.offsetParent === null) return;
      e.preventDefault();
      void saveRef.current(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const status = normalizeStatus(formData.status);
  const wage = normalizeWage(formData.wageType);
  const showSalary = wage === "salary" || wage === "mixed";
  const showHourly = wage === "hourly";
  const showPiece = wage === "piecework" || wage === "mixed";

  const describeHistoryValue = (v: Record<string, unknown> | null) => {
    if (!v) return "—";
    const parts: string[] = [];
    if (v.status) parts.push(STATUS_LABELS[normalizeStatus(String(v.status))]);
    if (v.baseSalary != null) parts.push(fmtMoney(v.baseSalary));
    if (v.positionId) {
      const p = positionsList.find((x) => x.id === v.positionId);
      parts.push(p?.title || "Lavozim");
    }
    if (v.departmentId) {
      const d = departmentsList.find((x) => x.id === v.departmentId);
      parts.push(d?.name || "Bo'lim");
    }
    return parts.join(" · ") || "—";
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Asosiy", icon: User },
    { id: "wage", label: "Ish haqi", icon: CreditCard },
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
    {
      id: "skills",
      label: "Malaka",
      icon: Award,
      badge: (formData.skills || []).length > 0 ? String((formData.skills || []).length) : null,
    },
    ...(employeeDbId ? [{ id: "ledger", label: "Hisob", icon: Wallet }] : []),
    {
      id: "history",
      label: "Tarix",
      icon: History,
      badge: historyList.length > 0 ? String(historyList.length) : null,
    },
  ];

  const fullNameShown = (formData.fullName || "").trim();
  const skills = formData.skills || [];

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-background text-foreground text-xs">
      {/* ── Level 2: Document Header ── */}
      <DocumentHeader
        icon={User}
        title={fullNameShown || (isNewRecord ? "Yangi xodim" : "Nomsiz xodim")}
        docNo={formData.badgeNumber || formData.badgeNo || "EMP-0000"}
        status={isNewRecord ? "Qoralama" : STATUS_LABELS[status]}
        actions={
          <div className="flex items-center gap-1.5">
            {!isNewRecord && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => window.print()}
                  title="Chop etish"
                >
                  <Printer className="size-3.5" />
                </Button>

                {status === "terminated" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={saving}
                    onClick={() => void handleToggleStatus("active")}
                  >
                    <UserCheck className="size-3.5" />
                    Faollashtirish
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                    disabled={saving}
                    onClick={() => setConfirmTerminate(true)}
                  >
                    <UserX className="size-3.5" />
                    Bo'shatish
                  </Button>
                )}
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={saving}
              onClick={() => void handleSave(false)}
              title="Saqlash (Ctrl+S)"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isSaved ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              ) : (
                <Save className="size-3.5" />
              )}
              {isSaved ? "Saqlandi" : "Saqlash"}
            </Button>

            <Button size="sm" className="h-7 text-xs gap-1" disabled={saving} onClick={handlePostAndClose}>
              <CheckCircle2 className="size-3.5" />
              Saqlab yopish
            </Button>
          </div>
        }
      />

      {/* ── Main Layout: Sidebar + Document Workspace ── */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden">
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              avatar={
                formData.avatarUrl ? (
                  <Avatar size="sm" className="size-8">
                    <AvatarImage src={formData.avatarUrl} alt={fullNameShown} className="object-cover" />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(fullNameShown)}
                    </AvatarFallback>
                  </Avatar>
                ) : undefined
              }
              icon={!formData.avatarUrl ? User : undefined}
              title={fullNameShown || (isNewRecord ? "Yangi xodim" : "Nomsiz xodim")}
              subtitle={formData.positionTitle || formData.position || "Lavozim yo'q"}
            >
              <InfoRow label="Bo'lim">{formData.departmentName || formData.department || "—"}</InfoRow>
              <InfoRow label="Filial">{formData.plant || "—"}</InfoRow>
              <InfoRow label="To'lov">{WAGE_LABELS[wage]}</InfoRow>
              {showSalary && (
                <InfoRow label="Oklad">
                  <span className="font-mono font-medium">{fmtMoney(formData.baseSalary)}</span>
                </InfoRow>
              )}
              {showHourly && (
                <InfoRow label="Soatbay">
                  <span className="font-mono font-medium">{fmtMoney(formData.hourlyRate)}</span>
                </InfoRow>
              )}
            </SidebarSummaryCard>
          }
          sectionsLabel="Bo'limlar"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
          footer={
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Ishbay</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(totalPieceworkEarned)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Ish soati</span>
                <span className="font-mono font-medium">{totalHoursWorked}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Smena</span>
                <span className="truncate">{SHIFT_LABELS[formData.currentShift || "day"] || formData.currentShift}</span>
              </div>
            </div>
          }
        />

        {/* Right Content Area: Level 3 Tabs */}
        <div
          className={cn(
            "flex-1 min-w-0 min-h-0 flex flex-col",
            activeTab === "piecework" || activeTab === "attendance"
              ? "p-0 overflow-hidden"
              : "overflow-y-auto p-3 gap-3"
          )}
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <Card className="w-full gap-0 py-0">
                <CardHeader className="py-2 px-3 border-b">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <User className="size-3.5 text-primary" />
                    Asosiy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* 3x4 Photo */}
                    <div className="flex flex-col items-center gap-1 shrink-0 self-center sm:self-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative w-24 h-32 rounded-md border border-dashed border-border hover:border-primary/60 bg-muted/30 overflow-hidden flex flex-col items-center justify-center transition-colors"
                        title={formData.avatarUrl ? "Rasmni almashtirish" : "Rasm yuklash (3x4)"}
                      >
                        {formData.avatarUrl ? (
                          <>
                            <img src={formData.avatarUrl} alt={fullNameShown} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Camera className="size-4" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            <Camera className="size-5 group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-medium">3x4</span>
                          </div>
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
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
                            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                            onClick={handleRemovePhoto}
                            title="Rasmni o'chirish"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Form Fields Grid */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-3 gap-y-2.5 w-full">
                      <Field label="Familiya" required error={errors.lastName}>
                        <Input
                          autoFocus={isNewRecord}
                          value={formData.lastName || ""}
                          onChange={(e) => {
                            const lName = e.target.value;
                            handleUpdate({
                              lastName: lName,
                              fullName: [lName, formData.firstName, formData.middleName].filter(Boolean).join(" ").trim(),
                            });
                          }}
                          placeholder="Karimov"
                          className={cn("h-7 text-xs font-medium", errCls(errors.lastName))}
                        />
                      </Field>

                      <Field label="Ism" required error={errors.firstName}>
                        <Input
                          value={formData.firstName || ""}
                          onChange={(e) => {
                            const fName = e.target.value;
                            handleUpdate({
                              firstName: fName,
                              fullName: [formData.lastName, fName, formData.middleName].filter(Boolean).join(" ").trim(),
                            });
                          }}
                          placeholder="Sardor"
                          className={cn("h-7 text-xs font-medium", errCls(errors.firstName))}
                        />
                      </Field>

                      <Field label="Otasining ismi">
                        <Input
                          value={formData.middleName || ""}
                          onChange={(e) => {
                            const mName = e.target.value;
                            handleUpdate({
                              middleName: mName,
                              fullName: [formData.lastName, formData.firstName, mName].filter(Boolean).join(" ").trim(),
                            });
                          }}
                          placeholder="Anvarovich"
                          className="h-7 text-xs font-medium"
                        />
                      </Field>

                      <Field label="Tabel raqami" required error={errors.badgeNumber}>
                        <Input
                          value={formData.badgeNumber || formData.badgeNo || ""}
                          onChange={(e) => handleUpdate({ badgeNumber: e.target.value, badgeNo: e.target.value })}
                          className={cn("h-7 text-xs font-mono font-semibold", errCls(errors.badgeNumber))}
                        />
                      </Field>

                      <Field label="Bo'lim" required error={errors.departmentName}>
                        <ComboboxSelect
                          items={departmentOptions}
                          value={formData.departmentName || formData.department || ""}
                          onValueChange={(val) => {
                            if (val) {
                              const matched = departmentsList.find((d) => d.name === val || d.id === val);
                              handleUpdate({
                                departmentName: val,
                                department: val,
                                departmentId: matched?.id || formData.departmentId,
                                departmentCode: matched?.code || formData.departmentCode,
                                plant: matched?.plant || formData.plant,
                                branchId: matched?.branchId || formData.branchId,
                                companyId: matched?.companyId || formData.companyId,
                              });
                            }
                          }}
                          allowCustom
                          placeholder="Tanlang"
                          className={cn("h-7 text-xs w-full font-medium", errCls(errors.departmentName))}
                          contentClassName="w-[320px]"
                          actionLabel="Yangi bo'lim"
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
                                <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">{dept.description}</span>
                              )}
                            </div>
                          )}
                        />
                      </Field>

                      <Field label="Lavozim" required error={errors.positionTitle}>
                        <ComboboxSelect
                          items={positionOptions}
                          value={formData.positionTitle || formData.position || ""}
                          onValueChange={(val) => {
                            if (val) {
                              const matched = positionsList.find((p) => p.title === val || p.id === val);
                              handleUpdate({
                                positionTitle: val,
                                position: val,
                                positionId: matched?.id || formData.positionId,
                                wageType: (matched?.defaultWageType as any) || formData.wageType,
                              });
                            }
                          }}
                          allowCustom
                          placeholder="Tanlang"
                          className={cn("h-7 text-xs w-full font-medium", errCls(errors.positionTitle))}
                          contentClassName="w-[320px]"
                          actionLabel="Yangi lavozim"
                          onAction={(query) => {
                            openTab({
                              id: `pos-new-${Date.now()}`,
                              title: query?.trim() || "Yangi lavozim",
                              type: "position-detail",
                              module: "hr",
                              documentData: { title: query?.trim() || "", isNew: true },
                            });
                          }}
                          renderItem={(pos) => (
                            <div className="flex items-center justify-between w-full min-w-0 pr-1 py-0.5">
                              <span className="text-xs font-medium text-foreground truncate">{pos.label}</span>
                              {pos.description && (
                                <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">{pos.description}</span>
                              )}
                            </div>
                          )}
                        />
                      </Field>

                      <Field label="Holati" required>
                        <Select
                          value={status}
                          onValueChange={(val) => {
                            if (val) handleUpdate({ status: val as NormalizedStatus });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue>{STATUS_LABELS[status]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABELS) as NormalizedStatus[]).map((k) => (
                              <SelectItem key={k} value={k}>
                                {STATUS_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Qabul sanasi" required error={errors.hireDate}>
                        <DatePicker
                          value={formData.hireDate}
                          onChange={(val) => handleUpdate({ hireDate: val })}
                          className={cn("h-7 text-xs font-mono", errCls(errors.hireDate))}
                        />
                      </Field>

                      <Field label="Telefon" required error={errors.phone}>
                        <PhoneInput
                          value={formData.phone || ""}
                          onChange={(e) => handleUpdate({ phone: e.target.value })}
                          placeholder="+998 90 123-45-67"
                          className={cn("h-7 text-xs font-mono", errCls(errors.phone))}
                        />
                      </Field>

                      <Field label="Pochta" error={errors.email}>
                        <Input
                          type="email"
                          value={formData.email || ""}
                          onChange={(e) => handleUpdate({ email: e.target.value })}
                          className={cn("h-7 text-xs", errCls(errors.email))}
                          placeholder="xodim@printgoo.uz"
                        />
                      </Field>

                      <Field label="Smena" required>
                        <Select
                          value={formData.currentShift || "day"}
                          onValueChange={(val) => {
                            if (val) handleUpdate({ currentShift: val });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue>
                              {SHIFT_LABELS[formData.currentShift || "day"] || formData.currentShift}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Tashkilot">
                        <OrgUnitSelect
                          branchId={formData.branchId}
                          companyId={formData.companyId}
                          value={formData.plant}
                          onValueChange={(val) => {
                            handleUpdate({
                              branchId: val.branchId,
                              companyId: val.companyId,
                              plant: val.label,
                            });
                          }}
                          placeholder="Tanlang"
                        />
                      </Field>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Passport & Legal Data */}
              <Card className="w-full gap-0 py-0">
                <CardHeader className="py-2 px-3 border-b">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-primary" />
                    Rekvizitlar
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-3 gap-y-2.5">
                  <Field label="Pasport">
                    <Input
                      value={formData.passportNo || formData.passportNumber || ""}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        handleUpdate({ passportNo: v, passportNumber: v });
                      }}
                      className="h-7 text-xs font-mono"
                      maxLength={12}
                      placeholder="AA 1234567"
                    />
                  </Field>

                  <Field label="JSHSHIR" error={errors.pinfl}>
                    <Input
                      value={formData.pinfl || ""}
                      onChange={(e) => handleUpdate({ pinfl: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                      inputMode="numeric"
                      className={cn("h-7 text-xs font-mono", errCls(errors.pinfl))}
                      placeholder="14 raqam"
                    />
                  </Field>

                  <Field label="Izoh" className="sm:col-span-2 lg:col-span-3 2xl:col-span-4">
                    <Textarea
                      value={formData.notes || ""}
                      onChange={(e) => handleUpdate({ notes: e.target.value })}
                      className="min-h-12 text-xs"
                      rows={2}
                    />
                  </Field>
                </CardContent>
              </Card>

              {/* Shop-floor terminal access */}
              {!isNewRecord && (
                <Card className="w-full gap-0 py-0">
                  <CardHeader className="py-2 px-3 border-b">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Fingerprint className="size-3.5 text-primary" />
                      Terminal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-3 gap-y-2.5">
                    <Field label="Kiosk PIN">
                      <div className="flex items-center gap-1">
                        <Input
                          value={terminalPin}
                          onChange={(e) => setTerminalPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && terminalPin.length === 4) void saveTerminalPin(terminalPin);
                          }}
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          placeholder={hasTerminalPin ? "O'rnatilgan" : "4 raqam"}
                          className="h-7 text-xs font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          disabled={savingPin || terminalPin.length !== 4}
                          onClick={() => void saveTerminalPin(terminalPin)}
                          title="PIN saqlash"
                        >
                          {savingPin ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                        </Button>
                        {hasTerminalPin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-destructive hover:bg-destructive/10"
                            disabled={savingPin}
                            onClick={() => void saveTerminalPin(null)}
                            title="PIN o'chirish"
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </Field>

                    <Field label="Face ID">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 w-full justify-start"
                        disabled={syncingBiometric || !formData.avatarUrl}
                        onClick={handleSyncToTerminals}
                        title={formData.avatarUrl ? "Turniketlarga yuborish" : "Avval rasm yuklang"}
                      >
                        {syncingBiometric ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="size-3.5" />
                        )}
                        Turniketga yuborish
                      </Button>
                    </Field>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* TAB 2: WAGE & RATES */}
          {activeTab === "wage" && (
            <Card className="w-full gap-0 py-0">
              <CardHeader className="py-2 px-3 border-b">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <CreditCard className="size-3.5 text-primary" />
                  Stavkalar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-3 gap-y-2.5">
                  <Field label="To'lov shakli" required>
                    <Select
                      value={wage}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ wageType: val as NormalizedWage });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue>{WAGE_LABELS[wage]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(WAGE_LABELS) as NormalizedWage[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {WAGE_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {showSalary && (
                    <Field label="Oklad, UZS" required error={errors.baseSalary}>
                      <MoneyInput
                        thousandSeparator=" "
                        decimalScale={0}
                        value={formData.baseSalary}
                        onValueChange={(values) => handleUpdate({ baseSalary: values.floatValue ?? 0 })}
                        className={cn("h-7 text-xs font-semibold", errCls(errors.baseSalary))}
                      />
                    </Field>
                  )}

                  {showHourly && (
                    <Field label="Soatbay, UZS" required error={errors.hourlyRate}>
                      <MoneyInput
                        thousandSeparator=" "
                        decimalScale={0}
                        value={formData.hourlyRate}
                        onValueChange={(values) => handleUpdate({ hourlyRate: values.floatValue ?? 0 })}
                        className={cn("h-7 text-xs", errCls(errors.hourlyRate))}
                      />
                    </Field>
                  )}

                  {showPiece && (
                    <Field label="K-tarif" required error={errors.pieceworkMultiplier}>
                      <MoneyInput
                        thousandSeparator=""
                        decimalScale={2}
                        value={formData.pieceworkMultiplier ?? formData.pieceworkRateMultiplier ?? 1}
                        onValueChange={(values) => {
                          const v = values.floatValue ?? 0;
                          handleUpdate({ pieceworkMultiplier: v, pieceworkRateMultiplier: v });
                        }}
                        className={cn("h-7 text-xs", errCls(errors.pieceworkMultiplier))}
                      />
                    </Field>
                  )}

                  <Field label="Bank kartasi">
                    <Input
                      value={formData.bankCardNo || ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                        handleUpdate({ bankCardNo: digits.replace(/(\d{4})(?=\d)/g, "$1 ") });
                      }}
                      inputMode="numeric"
                      className="h-7 text-xs font-mono"
                      placeholder="8600 0000 0000 0000"
                    />
                  </Field>
                </div>

                <div className="rounded border bg-muted/30 px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground">
                  {wage === "salary" && "Maosh = Oklad + Bonus − Ushlanma"}
                  {wage === "hourly" && "Maosh = Soat × Stavka + Bonus − Ushlanma"}
                  {wage === "piecework" && "Maosh = Σ(Hajm × Tarif) × K + Bonus − Ushlanma"}
                  {wage === "mixed" && "Maosh = Oklad + Σ(Hajm × Tarif) × K + Bonus − Ushlanma"}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: PIECEWORK HISTORY (GLIDE DATA GRID) */}
          {activeTab === "piecework" && (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden">
              <div className="h-9 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5 text-primary" />
                  <span className="font-semibold text-xs">Ishbay naryadlar</span>
                  <Badge variant="outline" className="font-mono text-[10px] h-5">
                    {employeePieceworks.length}
                  </Badge>
                </div>
                <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {fmtMoney(totalPieceworkEarned)}
                </span>
              </div>

              <div className="flex-1 w-full h-full relative" title="Buyurtmani ochish: 2 marta bosing">
                {employeePieceworks.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <Layers className="size-5 opacity-50" />
                    <span className="text-xs">Naryadlar yo'q</span>
                  </div>
                ) : (
                  <DataEditor
                    columns={pwCols}
                    rows={employeePieceworks.length}
                    getCellContent={getPieceworkCellContent}
                    onColumnResize={handlePieceworkColumnResize}
                    onCellActivated={handlePieceworkActivated}
                    gridSelection={pwSelection}
                    onGridSelectionChange={setPwSelection}
                    rowMarkers="number"
                    freezeColumns={1}
                    smoothScrollX
                    smoothScrollY
                    theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                    width="100%"
                    height="100%"
                    headerHeight={28}
                    rowHeight={28}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ATTENDANCE (GLIDE DATA GRID) */}
          {activeTab === "attendance" && (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden">
              <div className="h-9 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 text-primary" />
                  <span className="font-semibold text-xs">Davomat</span>
                  <Badge variant="outline" className="font-mono text-[10px] h-5">
                    {employeeAttendance.length} kun
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px] h-5">
                    {totalHoursWorked} soat
                  </Badge>
                  {lateCount > 0 && (
                    <Badge variant="outline" className="font-mono text-[10px] h-5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                      {lateCount} kechikish
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full h-full relative">
                {employeeAttendance.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="size-5 opacity-50" />
                    <span className="text-xs">Davomat yo'q</span>
                  </div>
                ) : (
                  <DataEditor
                    columns={attCols}
                    rows={employeeAttendance.length}
                    getCellContent={getAttendanceCellContent}
                    onColumnResize={handleAttendanceColumnResize}
                    gridSelection={attSelection}
                    onGridSelectionChange={setAttSelection}
                    rowMarkers="number"
                    freezeColumns={1}
                    smoothScrollX
                    smoothScrollY
                    theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                    width="100%"
                    height="100%"
                    headerHeight={28}
                    rowHeight={28}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SKILLS */}
          {activeTab === "skills" && (
            <Card className="w-full gap-0 py-0">
              <CardHeader className="py-2 px-3 border-b">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Award className="size-3.5 text-primary" />
                  Ko'nikmalar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 max-w-md">
                  <Input
                    value={newSkillText}
                    onChange={(e) => setNewSkillText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Stanok yoki texnologiya"
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 shrink-0"
                    disabled={!newSkillText.trim()}
                    onClick={handleAddSkill}
                  >
                    <Plus className="size-3.5" />
                    Qo'shish
                  </Button>
                </div>

                {skills.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">Ko'nikmalar yo'q</div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="h-6 pl-2 pr-1 text-xs font-medium flex items-center gap-1"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="O'chirish"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "ledger" && employeeDbId && <EmployeeLedgerPanel employeeId={employeeDbId} />}

          {/* TAB 6: HISTORY */}
          {activeTab === "history" && (
            <Card className="w-full gap-0 py-0">
              <CardHeader className="py-2 px-3 border-b">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <History className="size-3.5 text-primary" />
                  Kadrlar tarixi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading && historyList.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Yuklanmoqda
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">Tarix yo'q</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                      <tr className="h-7 text-left">
                        <th className="px-3 font-medium w-36">Sana</th>
                        <th className="px-3 font-medium w-24">Turi</th>
                        <th className="px-3 font-medium">Eski</th>
                        <th className="px-3 font-medium">Yangi</th>
                        <th className="px-3 font-medium w-32">Muallif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyList.map((item) => (
                        <tr key={item.id} className="h-7 border-t border-border">
                          <td className="px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(item.changedAt).toLocaleString("uz-UZ", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-3">
                            <Badge variant="outline" className="h-5 text-[10px]">
                              {HISTORY_TYPE_LABELS[item.changeType] || item.changeType}
                            </Badge>
                          </td>
                          <td className="px-3 text-muted-foreground">{describeHistoryValue(item.oldValue)}</td>
                          <td className="px-3 font-medium">{describeHistoryValue(item.newValue)}</td>
                          <td className="px-3 text-muted-foreground truncate">{item.changedBy || "Tizim"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmTerminate} onOpenChange={setConfirmTerminate}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <UserX className="size-4 text-destructive" />
              Xodimni bo'shatish
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {fullNameShown || "Xodim"} holati "Bo'shatilgan" qilib saqlanadi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3">
            <AlertDialogCancel className="h-8 text-xs">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-8 text-xs"
              onClick={() => void handleToggleStatus("terminated")}
            >
              Bo'shatish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
