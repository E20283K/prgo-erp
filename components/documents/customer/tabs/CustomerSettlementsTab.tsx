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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  CreditCard,
  Printer,
  Check,
  X,
  FileText,
  Filter,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  CrmCustomerRecord,
  ClientSettlementRecord,
  useWorkspaceStore,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { AktSverkaPrintModal } from "../components/AktSverkaPrintModal";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface CustomerSettlementsTabProps {
  customer: CrmCustomerRecord;
  settlement: ClientSettlementRecord | null;
  isPaymentOpen: boolean;
  setIsPaymentOpen: (open: boolean) => void;
  onOpenDeliveryAct: (docNo: string, debitAmount: number) => void;
}

export function CustomerSettlementsTab({
  customer,
  settlement,
  isPaymentOpen,
  setIsPaymentOpen,
  onOpenDeliveryAct,
}: CustomerSettlementsTabProps) {
  const { recordClientPayment, theme, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";

  // Print modal state
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Filter state
  const [filterPeriod, setFilterPeriod] = useState<string>("all");

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState("5000");
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState("Bank o'tkazmasi (UZS/USD)");
  const [paymentNote, setPaymentNote] = useState("");

  const handleConfirmPayment = () => {
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return;
    const customerKey = settlement ? settlement.customer : customer.name;
    const noteText = paymentNote.trim()
      ? `${paymentNote.trim()} (${paymentMethod})`
      : `Shartnoma ${customer.contractNo} bo'yicha to'lov (${paymentMethod})`;

    recordClientPayment(customerKey, amt, undefined, noteText);
    addNotification({
      title: "Mijoz to'lovi qabul qilindi",
      description: `${customer.name} hisobiga +$${amt.toLocaleString()} (${paymentMethod}) yozildi va Akt Sverka yangilandi.`,
      severity: "success",
      link: { module: "finance", subModule: "settlements" },
    });

    setIsPaymentOpen(false);
    setPaymentNote("");
  };

  // Base Ledger calculation
  const rawLedgerRows = useMemo(() => {
    if (!settlement) return [];
    let runningSaldo = settlement.openingBalance || 0;
    return settlement.ledger.map((entry, idx) => {
      runningSaldo = Number((runningSaldo + entry.debit - entry.credit).toFixed(2));
      return {
        idx: idx + 1,
        ...entry,
        runningSaldo,
      };
    });
  }, [settlement]);

  // Filtered Ledger Rows
  const filteredLedgerRows = useMemo(() => {
    if (filterPeriod === "all") return rawLedgerRows;
    if (filterPeriod === "debit-only") {
      return rawLedgerRows.filter((r) => r.debit > 0);
    }
    if (filterPeriod === "credit-only") {
      return rawLedgerRows.filter((r) => r.credit > 0);
    }
    if (filterPeriod === "last30") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoThreshold = thirtyDaysAgo.toISOString().split("T")[0];
      return rawLedgerRows.filter((r) => r.date >= isoThreshold);
    }
    return rawLedgerRows;
  }, [rawLedgerRows, filterPeriod]);

  // Columns definition with resizing support
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "idx", title: "№", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "date", title: "Sana (Date)", width: 110, icon: GridColumnIcon.HeaderDate },
    { id: "docNo", title: "Hujjat №", width: 120, icon: GridColumnIcon.HeaderReference },
    { id: "docType", title: "Operatsiya turi", width: 150, icon: GridColumnIcon.HeaderSingleValue },
    { id: "description", title: "Mazmuni / Asos (Shartnoma, Mahsulot)", width: 380, icon: GridColumnIcon.HeaderString },
    { id: "debit", title: "Debet / Yuklandi (+Dt $)", width: 165, icon: GridColumnIcon.HeaderNumber },
    { id: "credit", title: "Kredit / To'landi (-Kt $)", width: 165, icon: GridColumnIcon.HeaderNumber },
    { id: "runningSaldo", title: "Joriy Saldo ($)", width: 155, icon: GridColumnIcon.HeaderNumber },
  ]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === column.id ? { ...c, width: newSize } : c))
    );
  }, []);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = filteredLedgerRows[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "idx") {
        return {
          kind: GridCellKind.Number,
          data: item.idx,
          displayData: String(item.idx),
          allowOverlay: false,
          contentAlign: "center",
        };
      }

      if (column.id === "debit" || column.id === "credit" || column.id === "runningSaldo") {
        const val = Number(item[column.id as "debit" | "credit" | "runningSaldo"] || 0);
        const isDebit = column.id === "debit";
        const isCredit = column.id === "credit";
        const isSaldo = column.id === "runningSaldo";

        let color: string | undefined = undefined;
        if (isDebit && val > 0) color = isDark ? "#f87171" : "#b91c1c";
        if (isCredit && val > 0) color = isDark ? "#4ade80" : "#15803d";
        if (isSaldo) {
          color =
            val > 0
              ? isDark
                ? "#f87171"
                : "#b91c1c"
              : val < 0
              ? isDark
                ? "#60a5fa"
                : "#1d4ed8"
              : isDark
              ? "#4ade80"
              : "#15803d";
        }

        const display =
          val === 0 && !isSaldo
            ? "—"
            : `${isDebit && val > 0 ? "+" : isCredit && val > 0 ? "-" : ""}$${Math.abs(val).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;

        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: color
            ? { textDark: color, baseFontStyle: "700 12px monospace" }
            : undefined,
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal,
        allowOverlay: false,
      };
    },
    [filteredLedgerRows, columns, isDark]
  );

  const handleRowActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const entry = filteredLedgerRows[row];
      if (!entry) return;
      if (entry.docType === "Schet-faktura" || entry.docNo.startsWith("SF-")) {
        onOpenDeliveryAct(entry.docNo, entry.debit);
      }
    },
    [filteredLedgerRows, onOpenDeliveryAct]
  );

  const closingBalance = settlement?.closingBalance ?? 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Akt Sverka Action & KPI Sub-Header */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Kontragent / STIR
            </div>
            <div className="text-xs font-bold truncate max-w-[220px]">
              {customer.name} <span className="font-mono text-muted-foreground">({customer.tin})</span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Yuklandi (+Dt)
            </div>
            <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
              +${(settlement?.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami To&apos;landi (-Kt)
            </div>
            <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              -${(settlement?.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Joriy Saldo (Qoldiq)
            </div>
            <div
              className={`font-mono text-xs font-bold ${
                closingBalance > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : closingBalance < 0
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
              <span className="font-sans text-[10px] font-normal">
                ({closingBalance > 0 ? "Mijoz qarzdor" : closingBalance < 0 ? "Avans" : "Yopilgan"})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Period Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={filterPeriod} onValueChange={(v) => v && setFilterPeriod(v)}>
              <SelectTrigger className="h-7 text-[11px] w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha operatsiyalar</SelectItem>
                <SelectItem value="last30">Oxirgi 30 kun</SelectItem>
                <SelectItem value="debit-only">Faqat yuklangan (+Dt)</SelectItem>
                <SelectItem value="credit-only">Faqat to&apos;lovlar (-Kt)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            onClick={() => setIsPaymentOpen(!isPaymentOpen)}
            className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-none cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>+ To&apos;lov kiritish (Kirim)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPrintOpen(true)}
            className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>Akt Sverka Chop Etish</span>
          </Button>
        </div>
      </div>

      {/* Inline Payment Entry Bar (High density & No native number spinners) */}
      {isPaymentOpen && (
        <div className="px-4 py-2.5 bg-muted/80 border-b border-border flex flex-wrap items-end gap-3 shrink-0">
          <div className="space-y-1 w-36">
            <Label className="text-[11px] font-semibold">To&apos;lov summasi ($)</Label>
            <Input
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="5000"
              className="h-7 text-xs font-mono bg-background"
            />
          </div>

          <div className="space-y-1 w-52">
            <Label className="text-[11px] font-semibold">To&apos;lov usuli</Label>
            <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bank o'tkazmasi (UZS/USD)">Bank o&apos;tkazmasi (UZS/USD)</SelectItem>
                <SelectItem value="Korporativ karta (Payme / Click)">Korporativ karta</SelectItem>
                <SelectItem value="Naqd kassa (ПКО)">Naqd kassa (ПКО)</SelectItem>
                <SelectItem value="Akkreditiv / Faktoring">Akkreditiv / Faktoring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-[11px] font-semibold">Izoh / To&apos;lov topshiriqnomasi №</Label>
            <Input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={`Shartnoma ${customer.contractNo} bo'yicha to'lov...`}
              className="h-7 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleConfirmPayment}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tasdiqlash va Balansga yozish</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPaymentOpen(false)}
              className="h-7 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {/* Full-screen Glide Data Grid wrapped in Radix ContextMenu */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <DataEditor
            getCellContent={getCellContent}
            onCellActivated={handleRowActivated}
            columns={columns}
            onColumnResize={handleColumnResize}
            rows={filteredLedgerRows.length}
            rowMarkers="both"
            freezeColumns={3}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            headerHeight={28}
            rowHeight={30}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem
            onClick={() => {
              const rows = selection.rows.toArray();
              if (rows.length > 0) {
                handleRowActivated([0, rows[0]]);
              }
            }}
            className="gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Hujjatni ochish (F12)</span>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setIsPaymentOpen(true)}
            className="gap-2"
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Yangi to&apos;lov kiritish (Ins)</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setIsPrintOpen(true)}
            className="gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Akt Sverkani chop etish</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Official Printable Akt Sverka Dialog */}
      <AktSverkaPrintModal
        open={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        customer={customer}
        settlement={settlement}
      />
    </div>
  );
}
