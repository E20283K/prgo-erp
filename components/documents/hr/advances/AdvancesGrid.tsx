"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  GridColumnIcon,
  Item,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, RefreshCw, Search, Ban } from "lucide-react";
import type { EmployeeAdvanceRecord } from "../types";
import { AdvanceFormDialog } from "./AdvanceFormDialog";

const KIND_LABEL: Record<string, string> = { advance: "Avans", settlement: "Raschot" };
const METHOD_LABEL: Record<string, string> = { cash: "Naqd", card: "Karta" };
const SOURCE_LABEL: Record<string, string> = { ui: "ERP", telegram: "Bot" };

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AdvancesGrid() {
  const { theme, updateGridStats, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [data, setData] = useState<EmployeeAdvanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentPeriod());
  const [kind, setKind] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchData = useCallback(() => {
    const qs = new URLSearchParams({ period });
    if (kind !== "all") qs.set("kind", kind);
    return fetch(`/api/v1/hr/advances?${qs}`)
      .then((r) => r.json())
      .then((json) => setData(json.success && Array.isArray(json.data) ? json.data : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [period, kind]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = () => {
    setLoading(true);
    fetchData();
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return data.filter(
      (a) => !s || (a.employeeName || "").toLowerCase().includes(s) || (a.badgeNumber || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const active = filtered.filter((a) => a.status !== "cancelled");
    return {
      advance: active.filter((a) => a.kind === "advance").reduce((s, a) => s + a.amount, 0),
      settlement: active.filter((a) => a.kind === "settlement").reduce((s, a) => s + a.amount, 0),
    };
  }, [filtered]);

  useEffect(() => {
    updateGridStats?.(filtered.length, selection.rows.length);
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "advanceDate", title: "Sana", width: 95, icon: GridColumnIcon.HeaderDate },
      { id: "badgeNumber", title: "Tabel", width: 85, icon: GridColumnIcon.HeaderString },
      { id: "employeeName", title: "Hodim", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "amount", title: "Summa", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "kind", title: "Tur", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "paymentMethod", title: "Usul", width: 70, icon: GridColumnIcon.HeaderString },
      { id: "period", title: "Davr", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "source", title: "Manba", width: 65, icon: GridColumnIcon.HeaderString },
      { id: "createdByName", title: "Kiritdi", width: 150, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Holat", width: 95, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 220, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [c, r] = cell;
      const col = columns[c];
      const row = filtered[r];
      const empty: GridCell = { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      if (!col?.id || !row) return empty;
      const cancelled = row.status === "cancelled";
      const dim = cancelled ? { textDark: "#9ca3af" } : undefined;

      const text = (v: string, extra?: Partial<GridCell["themeOverride"]>): GridCell => ({
        kind: GridCellKind.Text,
        data: v,
        displayData: v,
        allowOverlay: false,
        themeOverride: { ...dim, ...extra },
      });

      switch (col.id) {
        case "amount":
          return text(`${row.amount.toLocaleString("uz-UZ")} ${row.currency}`, { baseFontStyle: "bold 12px monospace" });
        case "advanceDate":
          return text(row.advanceDate.split("-").reverse().join("."));
        case "kind":
          return text(KIND_LABEL[row.kind] ?? row.kind, row.kind === "settlement" && !cancelled ? { textDark: "#059669" } : undefined);
        case "paymentMethod":
          return text(METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod);
        case "source":
          return text(SOURCE_LABEL[row.source] ?? row.source);
        case "status":
          return text(cancelled ? "Bekor" : row.status === "deducted" ? "Ushlangan" : "Faol", cancelled ? { textDark: "#dc2626" } : undefined);
        case "notes":
          return text(cancelled && row.cancelReason ? `${row.notes ?? ""} [${row.cancelReason}]`.trim() : row.notes ?? "");
        default:
          return text(String((row as unknown as Record<string, unknown>)[col.id] ?? ""));
      }
    },
    [columns, filtered]
  );

  const selectedRows = useMemo(
    () => selection.rows.toArray().map((i) => filtered[i]).filter((r) => r && r.status !== "cancelled"),
    [selection.rows, filtered]
  );

  const handleCancel = async () => {
    if (selectedRows.length === 0) return;
    const reason = window.prompt(`${selectedRows.length} ta yozuvni bekor qilish sababi:`);
    if (reason === null) return;
    let failed = 0;
    for (const row of selectedRows) {
      const res = await fetch(`/api/v1/hr/advances/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (!json?.success) failed++;
    }
    addNotification({
      title: failed ? "Qisman bekor qilindi" : "Bekor qilindi",
      description: `${selectedRows.length - failed} ta yozuv`,
      severity: failed ? "warning" : "success",
    });
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
    fetchData();
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            <span>Yangi</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            disabled={selectedRows.length === 0}
            onClick={handleCancel}
          >
            <Ban className="size-3.5" />
            <span>Bekor qilish</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70 text-xs">
            <Calendar className="size-3 text-muted-foreground" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent font-mono text-xs focus:outline-none"
            />
          </div>

          <Select value={kind} onValueChange={(v) => v && setKind(v)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="advance">Avans</SelectItem>
              <SelectItem value="settlement">Raschot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hodim yoki tabel"
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={refresh}
            disabled={loading}
            aria-label="Yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Badge variant="outline" className="h-6 px-1.5 font-normal">
              Avans: {totals.advance.toLocaleString("uz-UZ")}
            </Badge>
            <Badge variant="outline" className="h-6 px-1.5 font-normal">
              Raschot: {totals.settlement.toLocaleString("uz-UZ")}
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
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            smoothScrollX
            smoothScrollY
          />
        </div>
      </div>

      <AdvanceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={fetchData} />
    </div>
  );
}
