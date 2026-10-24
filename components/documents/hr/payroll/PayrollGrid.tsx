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
import { PayrollRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  RefreshCw,
  Printer,
  Search,
  ExternalLink,
  Coins,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export function PayrollGrid() {
  const { theme, openTab, payrolls, updateGridStats, addNotification } = useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("2026-10");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch(`/api/v1/hr/payroll?period=${selectedPeriod}`),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(payrolls);
      }
    } catch {
      setData(payrolls);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, payrolls]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const s = searchFilter.toLowerCase();
      return (
        p.employeeName.toLowerCase().includes(s) ||
        (p.badgeNumber || p.badgeNo || "").toLowerCase().includes(s) ||
        (p.department || "").toLowerCase().includes(s)
      );
    });
  }, [data, searchFilter]);

  // Aggregate FOT metrics
  const totalGross = useMemo(() => filtered.reduce((s, p) => s + p.grossPay, 0), [filtered]);
  const totalNet = useMemo(() => filtered.reduce((s, p) => s + p.netPay, 0), [filtered]);
  const totalTaxes = useMemo(() => filtered.reduce((s, p) => s + p.taxDeduction, 0), [filtered]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "period", title: "Davr", width: 90, icon: GridColumnIcon.HeaderString },
      { id: "badgeNumber", title: "Tabel №", width: 95, icon: GridColumnIcon.HeaderString },
      { id: "employeeName", title: "Xodim F.I.O.", width: 210, icon: GridColumnIcon.HeaderString },
      { id: "department", title: "Sex / Bo'lim", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "wageType", title: "Stavka", width: 100, icon: GridColumnIcon.HeaderString },
      { id: "baseSalary", title: "Oklad (UZS)", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "pieceworkAmount", title: "Ishbay summa", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "bonusAmount", title: "Bonus", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "grossPay", title: "Jami hisoblangan", width: 150, icon: GridColumnIcon.HeaderNumber },
      { id: "totalDeductions", title: "Ushlanmalar", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "netPay", title: "Sof maosh (Net)", width: 160, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holati", width: 110, icon: GridColumnIcon.HeaderString },
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

      if (
        col.id === "baseSalary" ||
        col.id === "pieceworkAmount" ||
        col.id === "bonusAmount" ||
        col.id === "grossPay" ||
        col.id === "totalDeductions" ||
        col.id === "netPay"
      ) {
        const num = Number((row as any)[col.id]) || 0;
        return {
          kind: GridCellKind.Text,
          data: String(num),
          displayData: `${num.toLocaleString("uz-UZ")} UZS`,
          allowOverlay: true,
          themeOverride:
            col.id === "netPay"
              ? { textDark: "#059669", baseFontStyle: "bold 12px monospace" }
              : col.id === "grossPay"
              ? { textDark: "#2563eb", baseFontStyle: "bold 12px monospace" }
              : { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "badgeNumber") {
        const b = row.badgeNumber || row.badgeNo || "";
        return {
          kind: GridCellKind.Text,
          data: b,
          displayData: b,
          allowOverlay: true,
          themeOverride: { textDark: "#2563eb", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "status") {
        const isApproved = row.status === "approved" || row.status === "paid";
        return {
          kind: GridCellKind.Text,
          data: row.status,
          displayData: isApproved ? "Tasdiqlangan" : "Hisoblangan",
          allowOverlay: false,
          themeOverride: {
            textDark: isApproved ? "#059669" : "#d97706",
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
    (payroll: PayrollRecord) => {
      openTab({
        id: `pay-${payroll.id}`,
        title: `Hisob varaqasi: ${payroll.employeeName} (${payroll.period})`,
        type: "payroll-detail",
        module: "hr",
        documentData: payroll,
      });
    },
    [openTab]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const payroll = filtered[rowIndex];
      if (payroll) handleOpenDetail(payroll);
    },
    [filtered, handleOpenDetail]
  );

  // Auto calculate period payroll
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    try {
      const res = await fetch("/api/v1/hr/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Oylik hisob-kitobi yakunlandi",
          description: `${json.count} nafar xodim uchun ${selectedPeriod} davri oyligi hisoblandi.`,
          severity: "success",
        });
        fetchPayroll();
      }
    } catch {
      addNotification({
        title: "Hisoblashda xatolik",
        description: "Server xatosi yuz berdi",
        severity: "error",
      });
    } finally {
      setCalculating(false);
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
            disabled={calculating}
            onClick={handleCalculatePayroll}
          >
            <Coins className={`w-3.5 h-3.5 ${calculating ? "animate-spin" : ""}`} />
            <span>{calculating ? "Hisoblanmoqda..." : "Avtomatik hisoblash"}</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70 text-xs">
            <Calendar className="size-3 text-muted-foreground" />
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent font-mono text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Xodim yoki tabel №..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchPayroll}
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

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Badge variant="outline" className="h-6 px-1.5 font-normal">
              FOT: {totalGross.toLocaleString("uz-UZ")}
            </Badge>
            <Badge variant="outline" className="h-6 px-1.5 font-normal text-emerald-600 border-emerald-300">
              Sof: {totalNet.toLocaleString("uz-UZ")}
            </Badge>
          </div>
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
