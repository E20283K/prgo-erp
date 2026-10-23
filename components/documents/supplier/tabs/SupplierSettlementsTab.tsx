"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  RefreshCw,
  Filter,
  Copy,
  Plus,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import type { SupplierRecord, SupplierLedgerEntry } from "@/lib/server/supplierService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { SupplierAktSverkaModal } from "../components/SupplierAktSverkaModal";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface SupplierSettlementsTabProps {
  supplier: SupplierRecord;
  ledger?: SupplierLedgerEntry[];
  totalCredit?: number;
  totalDebit?: number;
  closingBalance?: number;
  loading?: boolean;
  onRefreshLedger?: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
  isPaymentOpen?: boolean;
  setIsPaymentOpen?: (open: boolean) => void;
}

interface BankAccountOption {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  currency: string;
}

export function SupplierSettlementsTab({
  supplier,
  ledger: propLedger,
  totalCredit: propCredit,
  totalDebit: propDebit,
  closingBalance: propBalance,
  loading: propLoading,
  onRefreshLedger,
  onBalanceUpdated,
  isPaymentOpen: externalPaymentOpen,
  setIsPaymentOpen: setExternalPaymentOpen,
}: SupplierSettlementsTabProps) {
  const { theme, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [internalLedger, setInternalLedger] = useState<SupplierLedgerEntry[]>([]);
  const [internalCredit, setInternalCredit] = useState(0);
  const [internalDebit, setInternalDebit] = useState(0);
  const [internalBalance, setInternalBalance] = useState(supplier.currentBalance || 0);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [internalPaymentOpen, setInternalPaymentOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const isPaymentOpen = externalPaymentOpen !== undefined ? externalPaymentOpen : internalPaymentOpen;
  const setIsPaymentOpen = setExternalPaymentOpen || setInternalPaymentOpen;

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<string>("all");

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    currency: supplier.currency || "UZS",
    method: "bank_transfer" as "bank_transfer" | "cash" | "corporate_card" | "offset",
    bankAccountId: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });

  const curr = supplier.currency || "UZS";

  // Use props if provided, otherwise internal state
  const ledger = propLedger !== undefined ? propLedger : internalLedger;
  const totalCredit = propCredit !== undefined ? propCredit : internalCredit;
  const totalDebit = propDebit !== undefined ? propDebit : internalDebit;
  const closingBalance = propBalance !== undefined ? propBalance : internalBalance;
  const loading = propLoading !== undefined ? propLoading : internalLoading;

  // Fetch Ledger data if parent didn't provide
  const fetchLedger = useCallback(async () => {
    if (onRefreshLedger) {
      onRefreshLedger();
      return;
    }
    if (!supplier.id || supplier.id.startsWith("draft-")) return;
    setInternalLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/ledger`);
      const json = await res.json();
      if (json.success && json.data) {
        setInternalLedger(json.data.ledger || []);
        setInternalCredit(json.data.totalCredit || 0);
        setInternalDebit(json.data.totalDebit || 0);
        const bal = json.data.closingBalance || 0;
        setInternalBalance(bal);
        if (onBalanceUpdated) onBalanceUpdated(bal);
      } else {
        setError(json.error || "Akt-sverka ma'lumotlarini olishda xatolik");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server bilan bog'lanishda xatolik");
    } finally {
      setInternalLoading(false);
    }
  }, [supplier.id, onRefreshLedger, onBalanceUpdated]);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/finance/bank-accounts");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBankAccounts(json.data);
        if (json.data.length > 0 && !paymentForm.bankAccountId) {
          setPaymentForm((prev) => ({ ...prev, bankAccountId: json.data[0].id }));
        }
      }
    } catch {
      // non-fatal
    }
  }, [paymentForm.bankAccountId]);

  useEffect(() => {
    if (propLedger === undefined) {
      fetchLedger();
    }
  }, [propLedger, fetchLedger]);

  useEffect(() => {
    if (isPaymentOpen) {
      fetchBankAccounts();
      if (!paymentForm.amount && closingBalance > 0) {
        setPaymentForm((prev) => ({
          ...prev,
          amount: String(closingBalance),
          note: `${supplier.name} bilan hisob-kitob bo'yicha to'lov`,
        }));
      }
    }
  }, [isPaymentOpen, fetchBankAccounts, closingBalance, supplier.name, paymentForm.amount]);

  const handleSavePayment = async () => {
    const numAmount = parseFloat(paymentForm.amount);
    if (!numAmount || numAmount <= 0) {
      alert("Iltimos, to'g'ri to'lov summasini kiriting!");
      return;
    }

    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          currency: paymentForm.currency,
          method: paymentForm.method,
          bankAccountId: paymentForm.bankAccountId || undefined,
          date: paymentForm.date,
          note: paymentForm.note,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setIsPaymentOpen(false);
        setPaymentForm((prev) => ({ ...prev, amount: "", note: "" }));
        fetchLedger();
        addNotification({
          title: "Ta'minotchi to'lovi amalga oshirildi",
          description: `${supplier.name} nomiga ${numAmount.toLocaleString()} ${paymentForm.currency} to'landi.`,
          severity: "success",
        });
      } else {
        alert(json.error || "To'lovni saqlashda xatolik");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "To'lovni amalga oshirishda xatolik");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Filtered rows
  const filteredLedger = useMemo(() => {
    if (filterPeriod === "all") return ledger;
    if (filterPeriod === "debit-only") return ledger.filter((r) => r.debit > 0);
    if (filterPeriod === "credit-only") return ledger.filter((r) => r.credit > 0);
    if (filterPeriod === "last30") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoThreshold = thirtyDaysAgo.toISOString().split("T")[0];
      return ledger.filter((r) => r.date >= isoThreshold);
    }
    return ledger;
  }, [ledger, filterPeriod]);

  // Columns definition
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "idx", title: "№", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "date", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
    { id: "docNo", title: "Hujjat №", width: 130, icon: GridColumnIcon.HeaderReference },
    { id: "docType", title: "Operatsiya turi", width: 150, icon: GridColumnIcon.HeaderSingleValue },
    { id: "description", title: "Mazmuni / Asos (Shartnoma, Material)", width: 380, icon: GridColumnIcon.HeaderString },
    { id: "debit", title: `Debet / To'landi (-Dt ${curr})`, width: 170, icon: GridColumnIcon.HeaderNumber },
    { id: "credit", title: `Kredit / Yetkazildi (+Kt ${curr})`, width: 170, icon: GridColumnIcon.HeaderNumber },
    { id: "balance", title: `Joriy Saldo (${curr})`, width: 160, icon: GridColumnIcon.HeaderNumber },
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
      const item = filteredLedger[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "idx") {
        return {
          kind: GridCellKind.Number,
          data: row + 1,
          displayData: String(row + 1),
          allowOverlay: false,
          contentAlign: "center",
        };
      }

      if (column.id === "docNo") {
        return {
          kind: GridCellKind.Text,
          data: item.docNo,
          displayData: item.docNo,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (column.id === "debit" || column.id === "credit" || column.id === "balance") {
        const val = Number(item[column.id as "debit" | "credit" | "balance"] || 0);
        const isDebit = column.id === "debit";
        const isCredit = column.id === "credit";
        const isSaldo = column.id === "balance";

        let color: string | undefined = undefined;
        if (isDebit && val > 0) color = isDark ? "#4ade80" : "#15803d"; // Biz to'ladik
        if (isCredit && val > 0) color = isDark ? "#60a5fa" : "#2563eb"; // Tovar oldik
        if (isSaldo) {
          color =
            val > 0
              ? isDark
                ? "#f87171"
                : "#b91c1c"
              : val < 0
              ? isDark
                ? "#4ade80"
                : "#15803d"
              : isDark
              ? "#a1a1aa"
              : "#71717a";
        }

        const display =
          val === 0 && !isSaldo
            ? "—"
            : `${isDebit && val > 0 ? "-" : isCredit && val > 0 ? "+" : ""}${Math.abs(val).toLocaleString("uz-UZ")} ${curr}`;

        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: color
            ? { textDark: color, baseFontStyle: "bold 12px monospace" }
            : { baseFontStyle: "600 12px monospace" },
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
    [filteredLedger, columns, isDark, curr]
  );

  const selectedItem = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return null;
    return filteredLedger[selectedRows[0]] || null;
  }, [selection, filteredLedger]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* 1. Header Toolbar & Quick KPI Strip */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Ta&apos;minotchi / STIR
            </div>
            <div className="text-xs font-bold truncate max-w-[220px]">
              {supplier.name} <span className="font-mono text-muted-foreground">({supplier.tin || "—"})</span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Yetkazildi (+Kt)
            </div>
            <div className="font-mono text-xs font-bold text-primary">
              +{totalCredit.toLocaleString("uz-UZ")} {curr}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami To&apos;landi (-Dt)
            </div>
            <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              -{totalDebit.toLocaleString("uz-UZ")} {curr}
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
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {Math.abs(closingBalance).toLocaleString("uz-UZ")} {curr}{" "}
              <span className="font-sans text-[10px] font-normal text-muted-foreground">
                ({closingBalance > 0 ? "Bizning qarzimiz" : closingBalance < 0 ? "Avansimiz" : "Nol"})
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
                <SelectItem value="credit-only">Faqat yetkazilgan (+Kt)</SelectItem>
                <SelectItem value="debit-only">Faqat to&apos;lovlar (-Dt)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            onClick={() => setIsPaymentOpen(!isPaymentOpen)}
            className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-none cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>+ To&apos;lov qilish (Chiqim)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>Akt Sverka Chop Etish</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLedger}
            disabled={loading}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 2. Inline Payment Entry Bar */}
      {isPaymentOpen && (
        <div className="px-4 py-2.5 bg-muted/80 border-b border-border flex flex-wrap items-end gap-3 shrink-0">
          <div className="space-y-1 w-36">
            <Label className="text-[11px] font-semibold">To&apos;lov summasi ({curr})</Label>
            <Input
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  amount: e.target.value.replace(/[^0-9.]/g, ""),
                }))
              }
              placeholder="5000000"
              className="h-7 text-xs font-mono bg-background"
            />
          </div>

          <div className="space-y-1 w-44">
            <Label className="text-[11px] font-semibold">To&apos;lov usuli</Label>
            <Select
              value={paymentForm.method}
              onValueChange={(val: any) => setPaymentForm((prev) => ({ ...prev, method: val }))}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank o&apos;tkazmasi (Hisobdan)</SelectItem>
                <SelectItem value="cash">Kassa naqd pul</SelectItem>
                <SelectItem value="corporate_card">Korporativ karta</SelectItem>
                <SelectItem value="offset">O&apos;zaro hisob-kitob (Zachyot)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {bankAccounts.length > 0 && paymentForm.method === "bank_transfer" && (
            <div className="space-y-1 w-52">
              <Label className="text-[11px] font-semibold">Chiqim bank hisobi</Label>
              <Select
                value={paymentForm.bankAccountId}
                onValueChange={(val) => setPaymentForm((prev) => ({ ...prev, bankAccountId: val || "" }))}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder="Bank hisobini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
                      {acc.bankName} ({acc.accountNumber.slice(-4)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1 w-32">
            <Label className="text-[11px] font-semibold">Sana</Label>
            <Input
              type="date"
              value={paymentForm.date}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
              className="h-7 text-xs bg-background"
            />
          </div>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-[11px] font-semibold">To&apos;lov maqsadi / Izoh</Label>
            <Input
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Masalan: Shartnoma bo'yicha metall forma va shtamplar uchun to'lov"
              className="h-7 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              disabled={paymentSubmitting}
              onClick={handleSavePayment}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-medium cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{paymentSubmitting ? "O'tkazilmoqda..." : "Tasdiqlash"}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPaymentOpen(false)}
              className="h-7 px-2 text-xs text-muted-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border-b border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Glide Data Grid Body */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <DataEditor
            columns={columns}
            rows={filteredLedger.length}
            getCellContent={getCellContent}
            onColumnResize={handleColumnResize}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            rowMarkers="both"
            freezeColumns={2}
            smoothScrollX
            smoothScrollY
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            width="100%"
            height="100%"
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="text-xs">
          {selectedItem && (
            <ContextMenuItem
              onClick={() => {
                navigator.clipboard.writeText(selectedItem.docNo);
              }}
              className="gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Hujjat raqamini nusxalash ({selectedItem.docNo})</span>
            </ContextMenuItem>
          )}

          {selectedItem && (
            <ContextMenuItem
              onClick={() => {
                const amt = selectedItem.debit || selectedItem.credit || 0;
                navigator.clipboard.writeText(String(amt));
              }}
              className="gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Summani nusxalash</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* 4. Print Akt-Sverka Modal */}
      <SupplierAktSverkaModal
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        supplier={supplier}
        ledger={ledger}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={closingBalance}
      />
    </div>
  );
}
