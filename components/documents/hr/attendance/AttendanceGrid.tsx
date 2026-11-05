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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { AttendanceRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Search,
  RefreshCw,
  Printer,
  Plus,
  ScanFace,
  Server,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

export function AttendanceGrid() {
  const { theme, openTab, attendance, upsertAttendance, updateGridStats, addNotification, employees } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isFaceIdSimOpen, setIsFaceIdSimOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState("");
  const [simEventType, setSimEventType] = useState<"check_in" | "check_out">("check_in");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/attendance"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(attendance);
      }
    } catch {
      setData(attendance);
    } finally {
      setLoading(false);
    }
  }, [attendance]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const s = searchFilter.toLowerCase();
      const matchSearch =
        a.employeeName.toLowerCase().includes(s) ||
        (a.badgeNumber || a.badgeNo || "").toLowerCase().includes(s) ||
        (a.department || "").toLowerCase().includes(s);

      const matchDate = !dateFilter || (a.workDate || a.date || "").includes(dateFilter);
      const matchStatus =
        statusFilter === "ALL" ||
        a.status === statusFilter ||
        (statusFilter === "on_leave" && (a.status === "OnLeave" || a.status === "vacation"));

      return matchSearch && matchDate && matchStatus;
    });
  }, [data, searchFilter, dateFilter, statusFilter]);

  // Statistics
  const presentCount = useMemo(
    () => filtered.filter((a) => a.status === "present" || a.status === "Present" || a.status === "late" || a.status === "Late").length,
    [filtered]
  );
  const lateCount = useMemo(() => filtered.filter((a) => a.status === "late" || a.status === "Late").length, [filtered]);

  const statusCounts = useMemo(() => {
    let late = 0;
    let absent = 0;
    let onLeave = 0;

    for (const a of data) {
      if (!dateFilter || (a.workDate || a.date || "").includes(dateFilter)) {
        if (a.status === "late" || a.status === "Late") late++;
        else if (a.status === "absent" || a.status === "Absent") absent++;
        else if (a.status === "OnLeave" || a.status === "vacation" || (a.status as string) === "on_leave") onLeave++;
      }
    }

    return { late, absent, onLeave };
  }, [data, dateFilter]);

  const otherStatusFilters = useMemo(
    () => [
      { key: "late", label: "Kechikkan", count: statusCounts.late },
      { key: "absent", label: "Kelmagan", count: statusCounts.absent },
      { key: "on_leave", label: "Ta'tilda", count: statusCounts.onLeave },
    ],
    [statusCounts]
  );

  const activeOtherStatus = useMemo(() => {
    return otherStatusFilters.find((item) => item.key === statusFilter);
  }, [otherStatusFilters, statusFilter]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "workDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
      { id: "badgeNumber", title: "Tabel №", width: 100, icon: GridColumnIcon.HeaderString },
      { id: "employeeName", title: "Xodim F.I.O.", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "department", title: "Sex / Bo'lim", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "shiftType", title: "Smena", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "checkIn", title: "Kirish", width: 85, icon: GridColumnIcon.HeaderTime },
      { id: "checkOut", title: "Chiqish", width: 85, icon: GridColumnIcon.HeaderTime },
      { id: "workedHours", title: "Ish soati", width: 100, icon: GridColumnIcon.HeaderNumber },
      { id: "delayMinutes", title: "Kechikish", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holati", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "sourceDevice", title: "Qurilma / Manba", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 200, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      const row = filtered[rowIndex];

      if (!col || !col.id || !row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (col.id === "badgeNumber") {
        const val = row.badgeNumber || row.badgeNo || "";
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: true,
          themeOverride: { textDark: "#2563eb", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "workedHours") {
        return {
          kind: GridCellKind.Text,
          data: String(row.workedHours),
          displayData: `${row.workedHours} soat`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "delayMinutes") {
        const d = row.delayMinutes || 0;
        return {
          kind: GridCellKind.Text,
          data: String(d),
          displayData: d > 0 ? `+${d} daq` : "—",
          allowOverlay: true,
          themeOverride: {
            textDark: d > 0 ? "#dc2626" : "#6b7280",
            baseFontStyle: d > 0 ? "bold 12px monospace" : "12px monospace",
          },
        };
      }

      if (col.id === "status") {
        const isLate = row.status === "late";
        const isPresent = row.status === "present";
        return {
          kind: GridCellKind.Text,
          data: row.status,
          displayData: isLate ? "Kechikkan" : isPresent ? "Kelgan" : row.status,
          allowOverlay: false,
          themeOverride: {
            textDark: isLate ? "#d97706" : isPresent ? "#059669" : "#6b7280",
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      const rawVal = (row as any)[col.id] ?? "";
      return {
        kind: GridCellKind.Text,
        data: String(rawVal),
        displayData: String(rawVal),
        allowOverlay: true,
      };
    },
    [columns, filtered]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const att = filtered[rowIndex];
      if (att) {
        openTab({
          id: `emp-${att.employeeId}`,
          title: `${att.employeeName} (${att.badgeNumber || att.badgeNo})`,
          type: "employee-detail",
          module: "hr",
          activeLevel3Tab: "attendance",
        });
      }
    },
    [filtered, openTab]
  );

  // Face ID Biometric Simulation
  const handleSimulateFaceId = async () => {
    if (!selectedBadge) return;

    try {
      const res = await fetch("/api/v1/hr/attendance/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "TURNSTILE-FACE-ID-01",
          badgeNumber: selectedBadge,
          timestamp: new Date().toISOString(),
          eventType: simEventType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Face ID Biometrik Qayd Etildi",
          description: json.message,
          severity: "success",
        });
        setIsFaceIdSimOpen(false);
        fetchAttendance();
      } else {
        addNotification({
          title: "Xatolik",
          description: json.message,
          severity: "error",
        });
      }
    } catch {
      addNotification({
        title: "Xatolik",
        description: "Server bilan aloqa uzildi",
        severity: "error",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── 1C Enterprise Industrial Toolbar ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
            onClick={() => {
              setSelectedBadge(employees[0]?.badgeNumber || employees[0]?.badgeNo || "EMP-0101");
              setIsFaceIdSimOpen(true);
            }}
          >
            <ScanFace className="size-3.5" />
            <span>Qayd etish</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1 border-border/80"
            onClick={() => {
              openTab({
                id: "registry-hr-devices",
                title: "Biometrik Qurilmalar",
                type: "registry",
                module: "hr",
              });
            }}
            title="Biometrik qurilmalar registri"
          >
            <Server className="size-3.5 text-muted-foreground" />
            <span>Qurilmalar</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Status Segment Filter Pills */}
          <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hammasi
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("present")}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                statusFilter === "present"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kelgan
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer outline-none ${
                  activeOtherStatus
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Boshqa holatlar"
              >
                <span>{activeOtherStatus ? activeOtherStatus.label : "Boshqa"}</span>
                {activeOtherStatus && (
                  <span className="ml-0.5 px-1 rounded-full text-[9px] bg-muted-foreground/15 font-mono">
                    {activeOtherStatus.count}
                  </span>
                )}
                <ChevronDown className="size-3 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36 p-1 text-xs">
                {otherStatusFilters.map(({ key, label, count }) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setStatusFilter(statusFilter === key ? "ALL" : key)}
                    className={`flex items-center justify-between px-2 py-1.5 cursor-pointer text-xs rounded ${
                      statusFilter === key
                        ? "bg-accent text-accent-foreground font-semibold"
                        : ""
                    }`}
                  >
                    <span>{label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground ml-2 px-1 rounded bg-muted">
                      {count}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DatePicker
            value={dateFilter}
            onChange={(val) => setDateFilter(val)}
            className="h-7 text-xs w-32 font-mono bg-background border-input rounded"
          />
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-1.5">
          <div className="relative w-44">
            <Search className="absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Qidiruv..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchAttendance}
            disabled={loading}
            title="Ro'yxatni yangilash"
            aria-label="Ro'yxatni yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => window.print()}
            title="Chop etish"
            aria-label="Chop etish"
          >
            <Printer className="size-3.5" />
          </Button>

          <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 font-normal">
            {filtered.length}
          </Badge>
          {lateCount > 0 && (
            <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 text-amber-600 border-amber-300 dark:border-amber-800 font-normal">
              {lateCount} kech
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden">
        <div className="absolute inset-0">
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={filtered.length}
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
      </div>

      {/* ── Face ID Simulation Modal ── */}
      <Dialog open={isFaceIdSimOpen} onOpenChange={setIsFaceIdSimOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ScanFace className="size-4 text-emerald-600" />
              Biometrik qayd etish
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-3">
            <div>
              <Label className="text-xs">Xodimni tanlang</Label>
              <Select value={selectedBadge} onValueChange={(val) => { if (val) setSelectedBadge(val); }}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.badgeNumber || e.badgeNo || ""}>
                      {e.fullName} ({e.badgeNumber || e.badgeNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Harakat turi</Label>
              <Select value={simEventType} onValueChange={(v: any) => { if (v) setSimEventType(v); }}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check_in">Kirish</SelectItem>
                  <SelectItem value="check_out">Chiqish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded border bg-muted/20 text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Avtomatik hisob-kitob qoidasi:
              </div>
              <p className="text-[11px] leading-relaxed">
                Kirishda 08:00 dan kech qayd etilsa kechikish hisoblanadi. Chiqishda esa oraliq vaqt ishlangan soat sifatida belgilanadi.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsFaceIdSimOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleSimulateFaceId}>
              <ScanFace className="size-3.5" />
              Qayd etish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
