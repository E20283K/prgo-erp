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
import { DepartmentRecord } from "../types";
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
import { Building2, Plus, Search, RefreshCw, Printer, ExternalLink, CheckCircle2 } from "lucide-react";

export function DepartmentsGrid() {
  const { theme, openTab, departmentsList, upsertDepartment, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // New Department form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/hr/departments");
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(departmentsList);
      }
    } catch {
      setData(departmentsList);
    } finally {
      setLoading(false);
    }
  }, [departmentsList]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      const s = searchFilter.toLowerCase();
      return d.name.toLowerCase().includes(s) || d.code.toLowerCase().includes(s);
    });
  }, [data, searchFilter]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "code", title: "Bo'lim kodi", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "name", title: "Sex / Bo'lim nomi", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "headPerson", title: "Sex boshlig'i", width: 190, icon: GridColumnIcon.HeaderString },
      { id: "phone", title: "Telefon", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "staffCount", title: "Xodimlar soni", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "plant", title: "Filial", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "isActive", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
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

      if (col.id === "code") {
        return {
          kind: GridCellKind.Text,
          data: row.code,
          displayData: row.code,
          allowOverlay: true,
          themeOverride: {
            textDark: "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "staffCount") {
        const count = row.staffCount || 0;
        return {
          kind: GridCellKind.Text,
          data: String(count),
          displayData: `${count} kishi`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "isActive") {
        const active = row.isActive !== false;
        return {
          kind: GridCellKind.Text,
          data: active ? "Active" : "Inactive",
          displayData: active ? "Faol" : "To'xtatilgan",
          allowOverlay: false,
          themeOverride: {
            textDark: active ? "#059669" : "#dc2626",
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

  const handleOpenDetail = useCallback(
    (dept: DepartmentRecord) => {
      openTab({
        id: `dept-${dept.id}`,
        title: `${dept.name} (${dept.code})`,
        type: "department-detail",
        module: "hr",
        documentData: dept,
      });
    },
    [openTab]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const dept = filtered[rowIndex];
      if (dept) handleOpenDetail(dept);
    },
    [filtered, handleOpenDetail]
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;

    const payload: Partial<DepartmentRecord> = {
      code: newCode.trim() || `DEP-${Date.now().toString().slice(-4)}`,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      headPerson: "Mavjud emas",
      phone: "+998 71 200-00-00",
      staffCount: 0,
      plant: "PrintGoo Bosh Zavod",
      isActive: true,
    };

    try {
      const res = await fetch("/api/v1/hr/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        payload.id = json.id;
        upsertDepartment(payload as DepartmentRecord);
        addNotification({
          title: "Sex qo'shildi",
          description: `${payload.name} ro'yxatga olindi.`,
          severity: "success",
        });
        setIsAddOpen(false);
        fetchDepartments();
        handleOpenDetail(payload as DepartmentRecord);
      }
    } catch {
      payload.id = `dep-${Date.now()}`;
      upsertDepartment(payload as DepartmentRecord);
      setIsAddOpen(false);
      handleOpenDetail(payload as DepartmentRecord);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="border-b bg-card p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm mr-2 text-foreground">
            <Building2 className="size-4 text-primary" />
            Sexlar va Bo'limlar Registri
            <Badge variant="secondary" className="font-mono text-xs ml-1 h-5">
              {filtered.length} ta
            </Badge>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Bo'lim nomi yoki kodi..."
              className="h-7 pl-8 text-xs font-sans"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchDepartments}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 font-medium"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Yangi sex qo'shish
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Yangi Sex / Bo'lim Qo'shish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kompaniya strukturasiga yangi ishlab chiqarish sexi yoki bo'lim kiritiladi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Sex kodi *</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="masalan: DEP-OFFSET"
                className="h-8 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Sex / Bo'lim nomi *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="masalan: Ofset bosma sexi"
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Izoh / Faoliyat yo'nalishi</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Texnologik tavsif..."
                className="h-8"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground gap-1" onClick={handleCreate}>
              <CheckCircle2 className="size-3.5" />
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
