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
import { EmployeeRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Search,
  Printer,
  ExternalLink,
  Plus,
  RefreshCw,
} from "lucide-react";

export function EmployeesGrid() {
  const { theme, openTab, employees, updateGridStats } = useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Load from API with fallback to store
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/hr/employees");
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(employees);
      }
    } catch {
      setData(employees);
    } finally {
      setLoading(false);
    }
  }, [employees]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Keep local data in sync when store employees update
  useEffect(() => {
    if (employees && employees.length > 0) {
      setData((prev) => {
        const map = new Map<string, EmployeeRecord>();
        prev.forEach((e) => map.set(e.id, e));
        employees.forEach((e) => map.set(e.id, e));
        return Array.from(map.values());
      });
    }
  }, [employees]);

  // Filtered rows
  const filtered = useMemo(() => {
    return data.filter((e) => {
      const s = searchFilter.toLowerCase();
      const matchSearch =
        e.fullName.toLowerCase().includes(s) ||
        (e.badgeNumber || e.badgeNo || "").toLowerCase().includes(s) ||
        (e.positionTitle || e.position || "").toLowerCase().includes(s);

      const matchDept =
        departmentFilter === "ALL" ||
        e.departmentName === departmentFilter ||
        e.department === departmentFilter;

      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;

      return matchSearch && matchDept && matchStatus;
    });
  }, [data, searchFilter, departmentFilter, statusFilter]);

  // Update status bar stats
  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  // Columns definition
  const columns: GridColumn[] = useMemo(
    () => [
      { id: "badgeNumber", title: "Tabel №", width: 100, icon: GridColumnIcon.HeaderString },
      { id: "fullName", title: "F.I.O. (Xodim)", width: 230, icon: GridColumnIcon.HeaderString },
      { id: "positionTitle", title: "Lavozim", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "departmentName", title: "Sex / Bo'lim", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "wageType", title: "To'lov shakli", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "baseSalary", title: "Oklad (UZS)", width: 145, icon: GridColumnIcon.HeaderNumber },
      { id: "currentShift", title: "Smena", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "phone", title: "Telefon", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "hireDate", title: "Ishga kirgan", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "status", title: "Holati", width: 115, icon: GridColumnIcon.HeaderString },
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

      if (col.id === "baseSalary") {
        const num = Number(row.baseSalary) || 0;
        return {
          kind: GridCellKind.Text,
          data: String(num),
          displayData: `${num.toLocaleString("uz-UZ")} UZS`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "badgeNumber") {
        const val = row.badgeNumber || row.badgeNo || "";
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: true,
          themeOverride: {
            textDark: "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "status") {
        const statusMap: Record<string, { label: string; color: string }> = {
          active: { label: "Faol", color: "#059669" },
          on_leave: { label: "Ta'tilda", color: "#d97706" },
          probation: { label: "Sinov", color: "#2563eb" },
          terminated: { label: "Bo'shatilgan", color: "#dc2626" },
        };
        const st = statusMap[row.status] || { label: row.status, color: "#6b7280" };
        return {
          kind: GridCellKind.Text,
          data: row.status,
          displayData: st.label,
          allowOverlay: false,
          themeOverride: {
            textDark: st.color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (col.id === "wageType") {
        const typeMap: Record<string, string> = {
          piecework: "Ishbay",
          salary: "Oklad",
          mixed: "Aralash",
          hourly: "Soatbay",
        };
        const text = typeMap[row.wageType] || row.wageType;
        return {
          kind: GridCellKind.Text,
          data: row.wageType,
          displayData: text,
          allowOverlay: false,
        };
      }

      if (col.id === "positionTitle") {
        const text = row.positionTitle || row.position || "—";
        return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: true };
      }

      if (col.id === "departmentName") {
        const text = row.departmentName || row.department || "—";
        return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: true };
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

  const handleOpenDetail = useCallback(
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
      const emp = filtered[rowIndex];
      if (emp) handleOpenDetail(emp);
    },
    [filtered, handleOpenDetail]
  );

  // Unified Employee Creation: opens the same EmployeeDetail document module
  const handleCreateNew = useCallback(() => {
    let maxNum = 0;
    const allEmp = data.length > 0 ? data : employees;
    for (const emp of allEmp) {
      const b = emp.badgeNumber || emp.badgeNo || "";
      const m = b.match(/EMP-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextBadge = `EMP-${String(maxNum + 1).padStart(4, "0")}`;
    const newDocId = `emp-new-${Date.now().toString().slice(-4)}`;

    const newEmp: EmployeeRecord = {
      id: newDocId,
      badgeNumber: nextBadge,
      badgeNo: nextBadge,
      firstName: "",
      lastName: "",
      fullName: "",
      phone: "+998 90 ",
      email: "",
      status: "active",
      wageType: "piecework",
      baseSalary: 4000000,
      hourlyRate: 0,
      pieceworkMultiplier: 1.0,
      pieceworkRateMultiplier: 1.0,
      currentShift: "day",
      hireDate: new Date().toISOString().split("T")[0],
      departmentName: "Flekso bosma sexi",
      department: "Flekso bosma sexi",
      positionTitle: "Pechatnik",
      position: "Pechatnik",
      plant: "PrintGoo Bosh Zavod",
      skills: ["Flekso bosma", "OTK nazorat"],
      notes: "",
    };

    openTab({
      id: newDocId,
      title: "Yangi xodim",
      type: "employee-detail",
      module: "hr",
      documentData: newEmp,
    });
  }, [data, employees, openTab]);

  // Keyboard navigation: Insert = Create, F12 / Enter = Open Card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Insert") {
        e.preventDefault();
        handleCreateNew();
      } else if (e.key === "F12") {
        const selectedRow = selection.rows.toArray()[0];
        if (selectedRow !== undefined && filtered[selectedRow]) {
          e.preventDefault();
          handleOpenDetail(filtered[selectedRow]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNew, handleOpenDetail, filtered, selection.rows]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── Top Industrial Toolbar ── */}
      <div className="border-b bg-card p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm mr-2 text-foreground">
            <Users className="size-4 text-primary" />
            Xodimlar
            <Badge variant="secondary" className="font-mono text-xs ml-1 h-5">
              {filtered.length}
            </Badge>
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

          <Select value={departmentFilter} onValueChange={(val) => { if (val) setDepartmentFilter(val); }}>
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

          <Select value={statusFilter} onValueChange={(val) => { if (val) setStatusFilter(val); }}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="Barcha holatlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Barcha holatlar</SelectItem>
              <SelectItem value="active">Faol</SelectItem>
              <SelectItem value="probation">Sinov</SelectItem>
              <SelectItem value="on_leave">Ta'tilda</SelectItem>
              <SelectItem value="terminated">Bo'shatilgan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={fetchEmployees}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 font-medium"
            onClick={handleCreateNew}
          >
            <UserPlus className="size-3.5" />
            Yangi xodim (Ins)
          </Button>

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

      {/* ── High-Performance Canvas Data Grid ── */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
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
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem
            onClick={() => {
              const selectedRow = selection.rows.toArray()[0] ?? 0;
              const emp = filtered[selectedRow];
              if (emp) handleOpenDetail(emp);
            }}
          >
            <ExternalLink className="size-3.5 mr-2" />
            Kartochkani ochish (F12)
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCreateNew}>
            <Plus className="size-3.5 mr-2" />
            Yangi xodim qo'shish (Ins)
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => window.print()}>
            <Printer className="size-3.5 mr-2" />
            T-2 Shaxsiy kartochkani chop etish
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
