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
import { useFindShortcut } from "@/hooks/use-find-shortcut";
import { ArrowDownLeft, ArrowUpRight, Calendar, RefreshCw, Search, Undo2 } from "lucide-react";
import { invalidateMoneyAccounts, useMoneyAccounts } from "@/components/finance/MoneyAccountSelect";
import type { CashTransactionRecord } from "@/lib/server/treasuryService";
import { CashEntryDialog } from "./CashEntryDialog";
import { apiJson, currentMonth, fmtDate, fmtMoney, monthEnd, SOURCE_LABEL } from "./format";

export function CashJournalGrid() {
  const { theme, updateGridStats, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";
  const accounts = useMoneyAccounts();

  const [data, setData] = useState<CashTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [accountId, setAccountId] = useState("all");
  const [direction, setDirection] = useState("all");
  const [search, setSearch] = useState("");
  const searchInputRef = useFindShortcut();
  const [entry, setEntry] = useState<"in" | "out" | null>(null);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchData = useCallback(() => {
    const qs = new URLSearchParams({ from: `${fromMonth}-01`, to: monthEnd(toMonth) });
    if (accountId !== "all") qs.set("accountId", accountId);
    if (direction !== "all") qs.set("direction", direction);
    return apiJson<{ data: CashTransactionRecord[] }>(`/api/v1/finance/cash-transactions?${qs}`)
      .then((j) => setData(j.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [fromMonth, toMonth, accountId, direction]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = () => {
    setLoading(true);
    fetchData();
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((r) =>
      [r.categoryName, r.counterpartyName, r.sourceDocNo, r.note, r.accountName, r.workOrderNo]
        .some((v) => (v || "").toLowerCase().includes(s))
    );
  }, [data, search]);

  // Live postings only: a reversed row and its storno cancel each other out.
  const totals = useMemo(() => {
    const live = filtered.filter((r) => r.status === "posted" && !r.isReversal);
    return {
      in: live.filter((r) => r.direction === "in").reduce((s, r) => s + r.amountUzs, 0),
      out: live.filter((r) => r.direction === "out").reduce((s, r) => s + r.amountUzs, 0),
    };
  }, [filtered]);

  useEffect(() => {
    updateGridStats?.(filtered.length, selection.rows.length);
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "date", title: "Sana", width: 90, icon: GridColumnIcon.HeaderDate },
      { id: "direction", title: "Tur", width: 70, icon: GridColumnIcon.HeaderString },
      { id: "categoryName", title: "Modda", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "amount", title: "Summa", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "accountName", title: "Hisob", width: 150, icon: GridColumnIcon.HeaderString },
      { id: "counterpartyName", title: "Kontragent", width: 200, icon: GridColumnIcon.HeaderString },
      { id: "sourceDocNo", title: "Hujjat", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "sourceType", title: "Manba", width: 90, icon: GridColumnIcon.HeaderString },
      { id: "workOrderNo", title: "Zakaz", width: 100, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Holat", width: 95, icon: GridColumnIcon.HeaderString },
      { id: "note", title: "Izoh", width: 220, icon: GridColumnIcon.HeaderString },
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
      const inactive = row.status !== "posted" || row.isReversal;
      const dim = inactive ? { textDark: "#9ca3af" } : undefined;
      const text = (v: string, extra?: Partial<GridCell["themeOverride"]>): GridCell => ({
        kind: GridCellKind.Text,
        data: v,
        displayData: v,
        allowOverlay: false,
        themeOverride: { ...dim, ...extra },
      });

      switch (col.id) {
        case "date":
          return text(fmtDate(row.date));
        case "direction":
          return text(row.direction === "in" ? "Kirim" : "Chiqim", inactive ? undefined : { textDark: row.direction === "in" ? "#059669" : "#dc2626" });
        case "amount": {
          const sign = row.direction === "in" ? "+" : "−";
          return text(`${sign}${fmtMoney(row.amount)} ${row.currency}`, { baseFontStyle: "600 12px monospace" });
        }
        case "accountName":
          return text(row.accountName ?? "—");
        case "sourceType":
          return text(SOURCE_LABEL[row.sourceType] ?? row.sourceType);
        case "status":
          return text(row.isReversal ? "Storno" : row.status === "reversed" ? "Stornolangan" : "Faol");
        default:
          return text(String((row as unknown as Record<string, unknown>)[col.id] ?? ""));
      }
    },
    [columns, filtered]
  );

  const reversible = useMemo(
    () =>
      selection.rows
        .toArray()
        .map((i) => filtered[i])
        .filter((r) => r && r.isManual && r.status === "posted" && !r.isReversal),
    [selection.rows, filtered]
  );
  const selectedCount = selection.rows.length;

  const handleReverse = async () => {
    if (selectedCount > reversible.length) {
      addNotification({
        title: "Storno",
        description: "Avans, to'lov va buyurtma yozuvlari o'z hujjatidan bekor qilinadi",
        severity: "warning",
      });
      if (!reversible.length) return;
    }
    const reason = window.prompt(`${reversible.length} ta yozuvni stornolash sababi:`);
    if (reason === null) return;
    let failed = 0;
    for (const row of reversible) {
      try {
        await apiJson(`/api/v1/finance/cash-transactions/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reverse", reason }),
        });
      } catch {
        failed++;
      }
    }
    addNotification({
      title: failed ? "Qisman stornolandi" : "Stornolandi",
      description: `${reversible.length - failed} ta yozuv`,
      severity: failed ? "warning" : "success",
    });
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
    invalidateMoneyAccounts();
    fetchData();
  };

  const accountName = accounts.find((a) => a.id === accountId)?.name;

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="min-h-10 py-1.5 border-b border-border bg-card px-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setEntry("out")}>
            <ArrowUpRight className="size-3.5" />
            <span>Chiqim</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" onClick={() => setEntry("in")}>
            <ArrowDownLeft className="size-3.5" />
            <span>Kirim</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            disabled={selectedCount === 0}
            onClick={handleReverse}
          >
            <Undo2 className="size-3.5" />
            <span>Storno</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70 text-xs">
            <Calendar className="size-3 text-muted-foreground" />
            <input
              type="month"
              value={fromMonth}
              onChange={(e) => e.target.value && setFromMonth(e.target.value)}
              className="bg-transparent font-mono text-xs focus:outline-none w-[118px]"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="month"
              value={toMonth}
              onChange={(e) => e.target.value && setToMonth(e.target.value)}
              className="bg-transparent font-mono text-xs focus:outline-none w-[118px]"
            />
          </div>

          <Select value={accountId} onValueChange={(v) => v && setAccountId(v as string)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue>{accountId === "all" ? "Barcha hisoblar" : accountName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Barcha hisoblar</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={direction} onValueChange={(v) => v && setDirection(v as string)}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue>{direction === "in" ? "Kirim" : direction === "out" ? "Chiqim" : "Barchasi"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Barchasi</SelectItem>
              <SelectItem value="in" className="text-xs">Kirim</SelectItem>
              <SelectItem value="out" className="text-xs">Chiqim</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish"
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
              Kirim: {fmtMoney(totals.in)}
            </Badge>
            <Badge variant="outline" className="h-6 px-1.5 font-normal">
              Chiqim: {fmtMoney(totals.out)}
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

      <CashEntryDialog
        open={entry !== null}
        direction={entry ?? "out"}
        onOpenChange={(o) => !o && setEntry(null)}
        onSaved={fetchData}
      />
    </div>
  );
}
