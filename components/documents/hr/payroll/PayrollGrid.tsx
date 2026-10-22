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
      const res = await fetch(`/api/v1/hr/payroll?period=${selectedPeriod}`);
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
      {/* ── Top Industrial Toolbar & KPI strip ── */}
      <div className="border-b bg-card p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm mr-2 text-foreground">
            <Calculator className="size-4 text-purple-600" />
            Ish Haqi Fondi (Payroll Ledger)
          </div>

          <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded border">
            <span className="text-muted-foreground">Hisob davri:</span>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent font-mono text-xs font-semibold focus:outline-none"
            />
          </div>

          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Xodim yoki tabel №..."
              className="h-7 pl-8 text-xs font-sans"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-mono border-r pr-3">
            <span className="text-muted-foreground">Jami FOT:</span>
            <span className="font-bold text-foreground">{totalGross.toLocaleString("uz-UZ")} UZS</span>
            <span className="text-muted-foreground ml-2">Sof to'lov:</span>
            <span className="font-bold text-emerald-600">{totalNet.toLocaleString("uz-UZ")} UZS</span>
          </div>

          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-medium"
            disabled={calculating}
            onClick={handleCalculatePayroll}
          >
            <Coins className={`size-3.5 ${calculating ? "animate-spin" : ""}`} />
            {calculating ? "Hisoblanmoqda..." : "Avtomatik hisoblash"}
          </Button>

          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={fetchPayroll}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </Button>

          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Chop etish
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
    </div>
  );
}
