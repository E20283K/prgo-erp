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
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import type { MoneyAccountRecord } from "@/lib/server/treasuryService";
import { MoneyAccountDialog } from "./MoneyAccountDialog";
import { apiJson, fmtMoney, KIND_LABEL } from "./format";

export function MoneyAccountsGrid() {
  const { theme, updateGridStats } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [data, setData] = useState<MoneyAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MoneyAccountRecord | null | undefined>(undefined); // undefined → closed
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchData = useCallback(
    () =>
      apiJson<{ data: MoneyAccountRecord[] }>("/api/v1/finance/bank-accounts")
        .then((j) => setData(j.data))
        .catch(() => setData([]))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    updateGridStats?.(data.length, selection.rows.length);
  }, [data.length, selection.rows.length, updateGridStats]);

  const totalsUzs = useMemo(
    () => data.filter((a) => a.isActive && a.currency === "UZS").reduce((s, a) => s + a.balance, 0),
    [data]
  );

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "name", title: "Nomi", width: 200, icon: GridColumnIcon.HeaderString },
      { id: "kind", title: "Tur", width: 70, icon: GridColumnIcon.HeaderString },
      { id: "currency", title: "Valyuta", width: 70, icon: GridColumnIcon.HeaderString },
      { id: "bankName", title: "Bank", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "accountNo", title: "Raqam", width: 190, icon: GridColumnIcon.HeaderString },
      { id: "openingBalance", title: "Boshlang'ich", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "totalIn", title: "Kirim", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "totalOut", title: "Chiqim", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "balance", title: "Qoldiq", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holat", width: 90, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [c, r] = cell;
      const col = columns[c];
      const row = data[r];
      const empty: GridCell = { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      if (!col?.id || !row) return empty;
      const dim = row.isActive ? undefined : { textDark: "#9ca3af" };
      const text = (v: string, extra?: Partial<GridCell["themeOverride"]>): GridCell => ({
        kind: GridCellKind.Text,
        data: v,
        displayData: v,
        allowOverlay: false,
        themeOverride: { ...dim, ...extra },
      });
      const mono = { baseFontStyle: "12px monospace" };
      switch (col.id) {
        case "kind":
          return text(KIND_LABEL[row.kind] ?? row.kind);
        case "openingBalance":
        case "totalIn":
        case "totalOut":
          return text(fmtMoney(row[col.id]), mono);
        case "balance":
          return text(fmtMoney(row.balance), {
            baseFontStyle: "600 12px monospace",
            ...(row.balance < 0 && row.isActive ? { textDark: "#dc2626" } : {}),
          });
        case "status":
          return text(!row.isActive ? "Yopilgan" : row.isDefault ? "Asosiy" : "Faol");
        default:
          return text(String((row as unknown as Record<string, unknown>)[col.id] ?? ""));
      }
    },
    [columns, data]
  );

  const selected = selection.rows.length === 1 ? data[selection.rows.first() ?? -1] : undefined;

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setEditing(null)}>
            <Plus className="size-3.5" />
            <span>Yangi</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            disabled={!selected}
            onClick={() => selected && setEditing(selected)}
          >
            <Pencil className="size-3.5" />
            <span>Tahrirlash</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            disabled={loading}
            aria-label="Yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Badge variant="outline" className="h-6 px-1.5 font-normal font-mono text-[11px]">
            Jami UZS: {fmtMoney(totalsUzs)}
          </Badge>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden">
        <div className="absolute inset-0">
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={data.length}
            getCellContent={getCellContent}
            rowMarkers="both"
            freezeColumns={1}
            headerHeight={28}
            rowHeight={27}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellActivated={([, r]) => data[r] && setEditing(data[r])}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            smoothScrollX
            smoothScrollY
          />
        </div>
      </div>

      <MoneyAccountDialog
        open={editing !== undefined}
        account={editing ?? null}
        onOpenChange={(o) => !o && setEditing(undefined)}
        onSaved={fetchData}
      />
    </div>
  );
}
