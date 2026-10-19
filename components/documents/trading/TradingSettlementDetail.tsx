"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { DocumentHeader } from "@/components/documents/common/DocumentShell";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scale,
  Printer,
  Download,
  Building2,
  Sparkles,
  TrendingUp,
  Receipt,
  FileCheck2,
} from "lucide-react";
import { INITIAL_SETTLEMENT_LEDGERS, INITIAL_YTT_ENTITIES } from "./data";
import { AktSverkaPrintModal } from "../customer/components/AktSverkaPrintModal";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function TradingSettlementDetail({ tab }: { tab: DocumentTab }) {
  const { clientSettlements, addNotification, theme } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData = tab.documentData || {};
  const customerName = rawData.customer || "'REAL TEXTILE INVEST' MChJ";
  const [selectedEntityId, setSelectedEntityId] = useState<string>("ytt-aliyev");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const selectedEntity = useMemo(() => {
    return (
      INITIAL_YTT_ENTITIES.find((e) => e.id === selectedEntityId) ||
      INITIAL_YTT_ENTITIES[0]
    );
  }, [selectedEntityId]);

  // Filter ledger strictly by selected legal entity
  const filteredLedger = useMemo(() => {
    return INITIAL_SETTLEMENT_LEDGERS.filter(
      (entry) =>
        entry.customer === customerName &&
        (selectedEntityId === "ytt-aliyev"
          ? entry.sellerEntityName.includes("Aliyev")
          : selectedEntityId === "ytt-qodirov"
          ? entry.sellerEntityName.includes("Qodirov")
          : entry.sellerEntityName.includes("PRINTGOO"))
    );
  }, [customerName, selectedEntityId]);

  const { totalDebit, totalCredit, closingBalance, currency } = useMemo(() => {
    let d = 0;
    let c = 0;
    const curr = selectedEntityId === "mchj-printgoo" ? "USD" : "UZS";
    filteredLedger.forEach((row) => {
      d += row.debit;
      c += row.credit;
    });
    return {
      totalDebit: d,
      totalCredit: c,
      closingBalance: d - c,
      currency: curr,
    };
  }, [filteredLedger, selectedEntityId]);

  // ─── Glide Data Grid for Ledger Entries ─────────────────────────────────────
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "docNo", title: "Hujjat Raqami / Turi", width: 220, icon: GridColumnIcon.HeaderReference },
      { id: "description", title: "Operatsiya Tavsifi", width: 300, icon: GridColumnIcon.HeaderString },
      { id: "debit", title: `Berilgan Tovar (Debet, ${currency})`, width: 180, icon: GridColumnIcon.HeaderNumber },
      { id: "credit", title: `Tushgan To'lov (Kredit, ${currency})`, width: 180, icon: GridColumnIcon.HeaderNumber },
      { id: "balance", title: `Qoldiq Saldo (${currency})`, width: 170, icon: GridColumnIcon.HeaderNumber },
    ],
    [currency]
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = filteredLedger[rowIndex];
      const col = columns[colIndex];
      if (!row || !col) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (col.id === "date") {
        return {
          kind: GridCellKind.Text,
          data: row.date,
          displayData: row.date,
          allowOverlay: false,
          readonly: true,
          themeOverride: { baseFontStyle: "11px monospace" },
        };
      }

      if (col.id === "docNo") {
        const val = `${row.docNo} (${row.docType})`;
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          readonly: true,
          themeOverride: { baseFontStyle: "600 11px sans-serif" },
        };
      }

      if (col.id === "description") {
        const desc =
          row.docType === "Sotuv Hujjati"
            ? "Aksessuarlar va furnitura jo'natildi"
            : row.docType === "Bank To'lovi"
            ? "Bank orqali hisob-raqamga to'lov kelib tushdi"
            : "Davr boshi boshlang'ich saldo";
        return {
          kind: GridCellKind.Text,
          data: desc,
          displayData: desc,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: isDark ? "#94a3b8" : "#64748b",
            baseFontStyle: "11px sans-serif",
          },
        };
      }

      if (col.id === "debit") {
        return {
          kind: GridCellKind.Number,
          data: row.debit,
          displayData: row.debit > 0 ? `${row.debit.toLocaleString()} ${row.currency}` : "—",
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "credit") {
        return {
          kind: GridCellKind.Number,
          data: row.credit,
          displayData: row.credit > 0 ? `${row.credit.toLocaleString()} ${row.currency}` : "—",
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#34d399" : "#059669",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "balance") {
        return {
          kind: GridCellKind.Number,
          data: row.balance,
          displayData: `${row.balance.toLocaleString()} ${row.currency}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: row.balance > 0 ? (isDark ? "#f59e0b" : "#d97706") : undefined,
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [columns, filteredLedger, isDark]
  );

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header (Reconciliation / Indigo Theme) */}
      <DocumentHeader
        icon={Scale}
        title={`O'zaro Hisob-kitob Dalolatnomasi (Akt-Sverka): ${customerName}`}
        docNo={`STL-${selectedEntity.code}`}
        date="01.10.2026 — 18.10.2026"
        status={closingBalance > 0 ? "Active" : "Completed"}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPrintModalOpen(true)}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              title="Akt-Sverka rasmiy PDF shakli"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Chop etish (PDF)</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addNotification({
                  title: "Excel eksport",
                  description: `${customerName} akt-sverkasi yuklab olinmoqda.`,
                  severity: "info",
                });
              }}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Excel</span>
            </Button>
          </>
        }
      />

      {/* SINGLE-PAGE RECONCILIATION SUMMARY AT TOP */}
      <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5">
        {/* TOP KPI CARDS: DEBET, KREDIT, SALDO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Card 1: Berilgan Tovar (Debet) */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Berilgan Tovar (Debet):</span>
            <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
              {totalDebit > 0 ? `${totalDebit.toLocaleString()} ${currency}` : "0"}
            </div>
            <span className="text-[10px] text-muted-foreground">Yuk xatlari / Sotuv bo&apos;yicha</span>
          </div>

          {/* Card 2: Tushgan To'lov (Kredit) */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Tushgan To&apos;lov (Kredit):</span>
            <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {totalCredit > 0 ? `${totalCredit.toLocaleString()} ${currency}` : "0"}
            </div>
            <span className="text-[10px] text-muted-foreground">Bank to&apos;lovlari bo&apos;yicha</span>
          </div>

          {/* Card 3: Oxirgi Qoldiq Qarz (Saldo) */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Oxirgi Saldo (Qoldiq):</span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 h-3.5 ${
                  closingBalance > 0
                    ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                }`}
              >
                {closingBalance > 0 ? "Mijoz Qarzdor" : "0 (Qarz yo'q)"}
              </Badge>
            </div>
            <div className={`text-sm font-mono font-bold ${
              closingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {closingBalance.toLocaleString()} {currency}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {closingBalance > 0 ? "Kutilayotgan tushum" : "Hisob-kitoblar tenglashgan"}
            </span>
          </div>

          {/* Card 4: Kontragent va Shartnoma */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Amaldagi Shartnoma:</span>
            <div className="text-xs font-semibold text-foreground truncate" title={customerName}>
              {customerName}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate block">
              {selectedEntityId === "ytt-aliyev"
                ? "№ AK-2025/11 (Aksessuarlar)"
                : selectedEntityId === "ytt-qodirov"
                ? "№ AK-2026/04 (Aksessuarlar)"
                : "№ PRG-2026/18 (Flexo & Jakkard)"}
            </span>
          </div>
        </div>

        {/* CONTROLS ROW: SELLER ENTITY SELECTOR & CROSS-SELL BANNER */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="w-36 shrink-0">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Sotuvchi Yuridik Shaxs:</span>
            </div>
            <Select
              value={selectedEntityId}
              onValueChange={(val) => setSelectedEntityId(val || "ytt-aliyev")}
            >
              <SelectTrigger className="h-7 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="ytt-aliyev">
                  YTT Aliyev Jamshid (Aksessuarlar)
                </SelectItem>
                <SelectItem value="ytt-qodirov">
                  YTT Qodirov Baxtiyor (Aksessuarlar)
                </SelectItem>
                <SelectItem value="mchj-printgoo">
                  &quot;PRINTGOO SERVICES&quot; MChJ (Flexo / Jakkard)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CROSS SELL ALERT BADGE / BUTTON */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded px-2.5 py-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-indigo-900 dark:text-indigo-300 font-medium">
                Cross-Sell: Bosmaxona xizmatlari taklif qilinmagan
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addNotification({
                  title: "Menejerga topshiriq biriktirildi",
                  description: `${customerName} uchun bosmaxona xizmatlari bo'yicha tijoriy taklif shakllantirish topshirig'i yaratildi.`,
                  severity: "success",
                });
              }}
              className="h-6 text-[10px] px-2 bg-indigo-600 text-white hover:bg-indigo-700 border-none cursor-pointer"
            >
              Taklif yaratish
            </Button>
          </div>
        </div>
      </div>

      {/* INDUSTRIAL ACTION TOOLBAR FOR LEDGER */}
      <div className="px-3 h-9 border-b border-border bg-card shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-xs text-foreground">
            Buxgalteriya Hujjatlari va Bank To&apos;lovlari Reestri
          </span>
          <Badge variant="secondary" className="font-mono text-[10px] h-5">
            {filteredLedger.length} ta operatsiya
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono">
            Sotuvchi INN: <strong className="text-foreground">{selectedEntity.inn}</strong>
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            Mijoz INN: <strong className="text-foreground">304891234</strong>
          </span>
        </div>
      </div>

      {/* GLIDE DATA GRID: ENTIRE LOWER VIEWPORT */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <DataEditor
            columns={columns}
            rows={filteredLedger.length}
            getCellContent={getCellContent}
            gridSelection={gridSelection}
            onGridSelectionChange={setGridSelection}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX
            smoothScrollY
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            width="100%"
            height="100%"
          />
        </div>
      </div>

      {/* Official Printable Akt Sverka Dialog */}
      <AktSverkaPrintModal
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        customer={{
          id: "cust-trd-stl",
          name: customerName,
          tin: "304891234",
          contractNo: "AK-2026/04",
        } as any}
        settlement={clientSettlements[0] || null}
      />
    </div>
  );
}
