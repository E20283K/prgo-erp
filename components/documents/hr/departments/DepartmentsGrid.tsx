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
import { generateNextCode } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, RefreshCw, Printer, ExternalLink, CheckCircle2 } from "lucide-react";

export function DepartmentsGrid() {
  const { theme, openTab, departmentsList, upsertDepartment, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/departments"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
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

  const handleCreateNew = useCallback(() => {
    const newId = `new-${Date.now()}`;
    const nextCode = generateNextCode("DEP", departmentsList.map((d) => d.code), 2);
    openTab({
      id: `dept-${newId}`,
      title: "Yangi sex",
      type: "department-detail",
      module: "hr",
      documentData: {
        id: newId,
        code: nextCode,
        name: "",
        description: "",
        headPerson: "",
        phone: "",
        staffCount: 0,
        plant: "PrintGoo Bosh Zavod",
        isActive: true,
      },
      isUnsaved: true,
    });
  }, [openTab, departmentsList]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── 1C Enterprise Industrial Toolbar ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
            onClick={handleCreateNew}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi sex</span>
          </Button>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Bo'lim nomi yoki kodi..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchDepartments}
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
    </div>
  );
}
