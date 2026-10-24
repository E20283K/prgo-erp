"use client";

import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { EmployeeRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { theme, openTab, employees, setEmployees, updateGridStats } = useWorkspaceStore();

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

  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    x: number;
    y: number;
  } | null>(null);
  const mouseCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const getCursorCardPosition = useCallback((clientX: number, clientY: number) => {
    const cardWidth = 240;
    const cardHeight = 280;
    let x = clientX + 16;
    let y = clientY + 12;

    if (typeof window !== "undefined") {
      if (x + cardWidth > window.innerWidth - 16) {
        x = clientX - cardWidth - 16;
      }
      if (x < 16) x = 16;

      if (y + cardHeight > window.innerHeight - 16) {
        y = clientY - cardHeight - 12;
      }
      if (y < 16) y = 16;
    }

    return { x, y };
  }, []);

  // Load from API with fallback to store
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/employees"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setData(json.data);
        setEmployees(json.data);
      } else {
        setData(employees);
      }
    } catch {
      setData(employees);
    } finally {
      setLoading(false);
    }
  }, [setEmployees]);

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
      { id: "badgeNumber", title: "Tabel №", width: 95, icon: GridColumnIcon.HeaderString },
      { id: "avatarUrl", title: "Rasm", width: 55, icon: GridColumnIcon.HeaderImage },
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

  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind === "cell") {
        const [col, row] = args.location;
        const column = columns[col];
        if (column?.id === "avatarUrl") {
          const rowData = filtered[row];
          if (rowData && rowData.avatarUrl && rowData.avatarUrl.trim().length > 0) {
            let clientX = mouseCoordsRef.current.x;
            let clientY = mouseCoordsRef.current.y;
            if (clientX === 0 && clientY === 0 && typeof document !== "undefined") {
              const rect = (args as any).bounds;
              if (rect) {
                clientX = rect.x + rect.width / 2;
                clientY = rect.y + rect.height / 2;
              }
            }
            const { x, y } = getCursorCardPosition(clientX, clientY);
            setHoveredPreview({
              url: rowData.avatarUrl.trim(),
              x,
              y,
            });
            return;
          }
        }
      }
      setHoveredPreview(null);
    },
    [columns, filtered, getCursorCardPosition]
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

      if (col.id === "avatarUrl") {
        const photo = row.avatarUrl?.trim() || "";
        return {
          kind: GridCellKind.Image,
          data: photo ? [photo] : [],
          displayData: photo ? [photo] : [],
          allowOverlay: false,
          rounding: 4,
          contentAlign: "center",
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
      middleName: "",
      fullName: "",
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
      {/* ── 1C Enterprise Industrial Toolbar ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleCreateNew}
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi xodim</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status Segment Filter Pills */}
          <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
            {[
              { key: "ALL", label: "Hammasi" },
              { key: "active", label: "Faol" },
              { key: "probation", label: "Sinov" },
              { key: "on_leave", label: "Ta'tilda" },
              { key: "terminated", label: "Bo'shatilgan" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  statusFilter === key
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Department Select Filter */}
          <Select
            value={departmentFilter}
            onValueChange={(val) => {
              if (val) setDepartmentFilter(val);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-36 bg-background border-input rounded">
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
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="F.I.O. yoki tabel №..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchEmployees}
            disabled={loading}
            title="Ro'yxatni yangilash"
            aria-label="Ro'yxatni yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => window.print()}
            title="Chop etish"
          >
            <Printer className="size-3.5" />
            <span className="hidden sm:inline">Chop etish</span>
          </Button>

          <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 font-normal">
            {filtered.length}
          </Badge>
        </div>
      </div>

      {/* ── High-Performance Canvas Data Grid ── */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <div
            className="absolute inset-0"
            onMouseMove={(e) => {
              mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
              if (hoveredPreview) {
                const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
              }
            }}
            onMouseLeave={() => setHoveredPreview(null)}
          >
            <DataEditor
              width="100%"
              height="100%"
              columns={columns}
              rows={filtered.length}
              getCellContent={getCellContent}
              rowMarkers="both"
              freezeColumns={2}
              headerHeight={28}
              rowHeight={32}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={handleCellActivated}
              onItemHovered={onItemHovered}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              smoothScrollX
              smoothScrollY
            />

            {/* Hover Image Preview (Full format avatar popup like Work Order preview) */}
            {hoveredPreview && (
              <div
                style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
                className="fixed z-50 pointer-events-none rounded-lg bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[240px] max-h-[300px] flex items-center justify-center overflow-hidden"
              >
                <img
                  src={hoveredPreview.url}
                  alt="Xodim fotosurati"
                  className="max-h-[280px] w-auto rounded object-cover"
                />
              </div>
            )}
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
