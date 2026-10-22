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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Briefcase,
  Building2,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

export function EmployeesGrid() {
  const { theme, openTab, employees, upsertEmployee, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // New Employee Form State
  const [newBadge, setNewBadge] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newDepartment, setNewDepartment] = useState("Flekso bosma sexi");
  const [newPosition, setNewPosition] = useState("Pechatnik");
  const [newWageType, setNewWageType] = useState<any>("piecework");
  const [newBaseSalary, setNewBaseSalary] = useState("4000000");
  const [newPhone, setNewPhone] = useState("+998 90 ");
  const [newShift, setNewShift] = useState("day");

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
      { id: "wageType", title: "To'lov turi", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "baseSalary", title: "Asosiy oklad (UZS)", width: 145, icon: GridColumnIcon.HeaderNumber },
      { id: "currentShift", title: "Smena grafigi", width: 130, icon: GridColumnIcon.HeaderString },
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
          active: { label: "Faol (Active)", color: "#059669" },
          on_leave: { label: "Ta'tilda", color: "#d97706" },
          probation: { label: "Sinov muddati", color: "#2563eb" },
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
          piecework: "Ishbay (Sdelka)",
          salary: "Oklad (Sobit)",
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

  const handleCreateEmployee = async () => {
    if (!newFullName.trim()) return;

    const payload: Partial<EmployeeRecord> = {
      badgeNumber: newBadge.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      badgeNo: newBadge.trim() || `EMP-${Date.now().toString().slice(-4)}`,
      fullName: newFullName.trim(),
      phone: newPhone.trim(),
      wageType: newWageType,
      baseSalary: Number(newBaseSalary) || 0,
      currentShift: newShift,
      hireDate: new Date().toISOString().split("T")[0],
      status: "active",
      department: newDepartment,
      departmentName: newDepartment,
      position: newPosition,
      positionTitle: newPosition,
      plant: "PrintGoo Bosh Zavod",
    };

    try {
      const res = await fetch("/api/v1/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        payload.id = json.employeeId;
        upsertEmployee(payload as EmployeeRecord);
        addNotification({
          title: "Xodim qo'shildi",
          description: `${payload.fullName} bazaga kiritildi.`,
          severity: "success",
        });
        setIsAddSheetOpen(false);
        fetchEmployees();
        handleOpenDetail(payload as EmployeeRecord);
      }
    } catch {
      payload.id = `emp-${Date.now()}`;
      upsertEmployee(payload as EmployeeRecord);
      setIsAddSheetOpen(false);
      handleOpenDetail(payload as EmployeeRecord);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── Top Industrial Toolbar ── */}
      <div className="border-b bg-card p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm mr-2 text-foreground">
            <Users className="size-4 text-primary" />
            Xodimlar va Kadrlar Ro'yxati
            <Badge variant="secondary" className="font-mono text-xs ml-1 h-5">
              {filtered.length} ta
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
              <SelectItem value="active">Faol (Active)</SelectItem>
              <SelectItem value="probation">Sinov muddatida</SelectItem>
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
            onClick={() => setIsAddSheetOpen(true)}
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
          <ContextMenuItem onClick={() => setIsAddSheetOpen(true)}>
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

      {/* ── Add Employee Sheet ── */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] p-5 text-xs overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Yangi Xodim Qo'shish
            </SheetTitle>
            <SheetDescription className="text-xs">
              Kadrlar bazasiga yangi xodim shaxsiy kartochkasi kiritiladi
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3.5 py-4">
            <div>
              <Label className="text-xs">Tabel raqami (Badge No)</Label>
              <Input
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                placeholder="Avtomatik (masalan: EMP-0108)"
                className="h-8 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs">To'liq F.I.O. *</Label>
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Familiya Ism Sharif"
                className="h-8 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sex / Bo'lim *</Label>
                <Select value={newDepartment} onValueChange={(val) => { if (val) setNewDepartment(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flekso bosma sexi">Flekso bosma</SelectItem>
                    <SelectItem value="Tikuvchilik va lenta sexi">Tikuvchilik sexi</SelectItem>
                    <SelectItem value="Kesish va qadoqlash sexi">Kesish va qadoqlash</SelectItem>
                    <SelectItem value="Prepress va dizayn">Prepress markazi</SelectItem>
                    <SelectItem value="Sifat nazorati (OTK)">Sifat nazorati</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Lavozim *</Label>
                <Input
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mehnat to'lovi shakli</Label>
                <Select value={newWageType} onValueChange={(val) => { if (val) setNewWageType(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piecework">Ishbay (Sdelka)</SelectItem>
                    <SelectItem value="mixed">Aralash (Oklad + Sdelka)</SelectItem>
                    <SelectItem value="salary">Oklad (Sobit oylik)</SelectItem>
                    <SelectItem value="hourly">Soatbay stavka</SelectItem>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefon raqami</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Smena grafigi</Label>
                <Select value={newShift} onValueChange={(val) => { if (val) setNewShift(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Smena A (08:00 - 20:00)</SelectItem>
                    <SelectItem value="night">Smena B (20:00 - 08:00)</SelectItem>
                    <SelectItem value="daily">Ofis (09:00 - 18:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddSheetOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground gap-1"
              onClick={handleCreateEmployee}
            >
              <CheckCircle2 className="size-3.5" />
              Xodimni kiritish
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
