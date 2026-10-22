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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  CalendarClock,
  Search,
  RefreshCw,
  Printer,
  Plus,
  ScanFace,
  CheckCircle2,
  Clock,
  AlertTriangle,
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
      const res = await fetch("/api/v1/hr/attendance");
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
        (a.badgeNumber || a.badgeNo || "").toLowerCase().includes(s);

      const matchDate = !dateFilter || (a.workDate || a.date || "").includes(dateFilter);
      const matchStatus = statusFilter === "ALL" || a.status === statusFilter;

      return matchSearch && matchDate && matchStatus;
    });
  }, [data, searchFilter, dateFilter, statusFilter]);

  // Statistics
  const presentCount = useMemo(
    () => filtered.filter((a) => a.status === "present" || a.status === "late").length,
    [filtered]
  );
  const lateCount = useMemo(() => filtered.filter((a) => a.status === "late").length, [filtered]);

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
      {/* ── Top Industrial Toolbar ── */}
      <div className="border-b bg-card p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm mr-2 text-foreground">
            <CalendarClock className="size-4 text-emerald-600" />
            T-13 Davomat va Ish Vaqti Tabeli
            <Badge variant="outline" className="font-mono text-xs ml-1 bg-emerald-50 text-emerald-700 border-emerald-300">
              {presentCount} kelgan
            </Badge>
            {lateCount > 0 && (
              <Badge variant="outline" className="font-mono text-xs bg-amber-50 text-amber-700 border-amber-300">
                {lateCount} kechikkan
              </Badge>
            )}
          </div>

          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="F.I.O. yoki tabel №..."
              className="h-7 pl-8 text-xs font-sans"
            />
          </div>

          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-7 text-xs w-36 font-mono"
          />

          <Select value={statusFilter} onValueChange={(val) => { if (val) setStatusFilter(val); }}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="Barcha status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Barcha status</SelectItem>
              <SelectItem value="present">Kelgan (Present)</SelectItem>
              <SelectItem value="late">Kechikkan (Late)</SelectItem>
              <SelectItem value="absent">Kelmagan</SelectItem>
              <SelectItem value="on_leave">Ta'tilda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 gap-1.5 font-medium"
            onClick={() => {
              setSelectedBadge(employees[0]?.badgeNumber || employees[0]?.badgeNo || "EMP-0101");
              setIsFaceIdSimOpen(true);
            }}
          >
            <ScanFace className="size-3.5 text-emerald-600" />
            Face ID Simulyatsiyasi
          </Button>

          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchAttendance}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </Button>

          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Tabelni chop etish
          </Button>
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
              Biometrik Turniket / Face ID Webhook Test
            </DialogTitle>
            <DialogDescription className="text-xs">
              Qurilmadan serverga yuboriladigan real check-in va check-out so'rovini tekshirish
            </DialogDescription>
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
              <Label className="text-xs">Harakat turi (Event Type)</Label>
              <Select value={simEventType} onValueChange={(v: any) => { if (v) setSimEventType(v); }}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check_in">Kirish (Check-in - Ertalab)</SelectItem>
                  <SelectItem value="check_out">Chiqish (Check-out - Kechqurun)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded border bg-muted/20 text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Avtomatik hisob-kitob qoidasi:
              </div>
              <p className="text-[11px] leading-relaxed">
                Kirishda 08:00 dan kech qayd etilsa kechikish (delay minutes) hisoblanadi. Chiqishda esa check-in va check-out oralig'i ishlangan vaqt (workedHours) sifatida belgilanadi.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsFaceIdSimOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleSimulateFaceId}>
              <ScanFace className="size-3.5" />
              Signaturani jo'natish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
