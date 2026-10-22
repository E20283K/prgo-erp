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
import { useTranslations } from "next-intl";
import {
  useWorkspaceStore,
  ClientSettlementRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Download,
  Printer,
  ExternalLink,
  Scale,
  Plus,
  FileText,
  CreditCard,
  Check,
} from "lucide-react";

interface FinanceGridProps {
  type: string; // "settlements" | "accounts" | "payments" | "bank" | "pnl" | "budget" | "cost-analysis"
}

export function FinanceGrid({ type }: FinanceGridProps) {
  const tCommon = useTranslations("Common");
  const tFin = useTranslations("FinanceGrid");
  const {
    updateGridStats,
    theme,
    clientSettlements,
    crmCustomers,
    recordClientPayment,
    recordPaymentAsync,
    loadFinanceData,
    isFinanceLoading,
    deliveryActs,
    openTab,
    setLevel3Tab,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("5000");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [realPayments, setRealPayments] = useState<any[]>([]);

  // Real DB dan Finance ma'lumotlarini yuklash
  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/finance/payments");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRealPayments(json.data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch payments:", e);
    }
  }, []);

  useEffect(() => {
    if (type === "payments") {
      fetchPayments();
    }
  }, [type, fetchPayments]);

  const selectedClient = useMemo<ClientSettlementRecord | null>(() => {
    if (!selectedClientId) return null;
    return clientSettlements.find((c) => c.id === selectedClientId) || null;
  }, [clientSettlements, selectedClientId]);

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let dataRows: any[] = [];

    if (type === "settlements") {
      cols = [
        { id: "id", title: "ID", width: 90, icon: GridColumnIcon.HeaderReference },
        { id: "customer", title: "Customer (Kontragent)", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "customerTin", title: "STIR (INN)", width: 105, icon: GridColumnIcon.HeaderReference },
        { id: "contractNo", title: "Contract №", width: 125, icon: GridColumnIcon.HeaderReference },
        { id: "openingBalance", title: "Opening ($)", width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: "totalDebit", title: "Shipped / SF (+Dt $)", width: 145, icon: GridColumnIcon.HeaderNumber },
        { id: "totalCredit", title: "Paid (-Kt $)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "closingBalance", title: "Balance / Saldo ($)", width: 145, icon: GridColumnIcon.HeaderNumber },
        { id: "lastActivityDate", title: "Last Activity", width: 115, icon: GridColumnIcon.HeaderDate },
        { id: "status", title: "Status", width: 115, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = clientSettlements;
    } else if (type === "payments") {
      cols = [
        { id: "id", title: "Payment No", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Date", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Counterparty", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "contractNo", title: "Contract / Ref", width: 150, icon: GridColumnIcon.HeaderReference },
        { id: "method", title: "Method", width: 140, icon: GridColumnIcon.HeaderLookup },
        { id: "amount", title: "Amount ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 115, icon: GridColumnIcon.HeaderSingleValue },
      ];
      const allPayments: any[] = [];
      clientSettlements.forEach((c) => {
        c.ledger
          .filter((l) => l.docType === "Payment")
          .forEach((l) => {
            allPayments.push({
              id: l.docNo,
              date: l.date,
              customer: c.customer,
              contractNo: c.contractNo,
              method: "Bank Wire (UZS/USD)",
              amount: l.credit,
              status: "Completed",
            });
          });
      });
      dataRows = realPayments.length > 0 ? realPayments : allPayments;
    } else if (type === "accounts") {
      cols = [
        { id: "code", title: "Acct Code (1C)", width: 120, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Account Name (NSBU / 1C)", width: 280, icon: GridColumnIcon.HeaderString },
        { id: "category", title: "Type", width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: "balance", title: "Balance ($)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = [
        { id: "4010", code: "4010", name: "Xaridor va buyurtmachilardan olinadigan schyotlar (Debitorlar)", category: "Active (Receivable)", balance: 18546.0, status: "Active" },
        { id: "9010", code: "9010", name: "Tayyor mahsulot (Schet-faktura) sotishdan daromadlar", category: "Revenue", balance: 142850.0, status: "Active" },
        { id: "6410", code: "6410", name: "Byudjetga to'lovlar bo'yicha qarz (QQS / NDS 12%)", category: "Liability (Tax)", balance: 15305.0, status: "Active" },
        { id: "5110", code: "5110", name: "Hisob-kitob schyoti (Milliy valyuta / Bank)", category: "Cash & Bank", balance: 68400.0, status: "Active" },
        { id: "2810", code: "2810", name: "Ombordagi tayyor mahsulotlar", category: "Inventory", balance: 41200.0, status: "Active" },
        { id: "1010", code: "1010", name: "Xomashyo va materiallar (Qog'oz, bo'yoq, plyonka)", category: "Inventory", balance: 89500.0, status: "Active" },
        { id: "2010", code: "2010", name: "Asosiy ishlab chiqarish (Poligrafiya tsexi)", category: "WIP / Production", balance: 23100.0, status: "Active" },
      ];
    } else {
      // cost-analysis (Order Cost & Margin / Buyurtmalar rentabelligi va tannarxi)
      cols = [
        { id: "id", title: "Order ID", width: 115, icon: GridColumnIcon.HeaderReference },
        { id: "workOrderId", title: "Work Order", width: 105, icon: GridColumnIcon.HeaderReference },
        { id: "customer", title: "Customer", width: 210, icon: GridColumnIcon.HeaderString },
        { id: "product", title: "Print Job Specification", width: 265, icon: GridColumnIcon.HeaderString },
        { id: "materialCost", title: "Materials ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "processCost", title: "Operations ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "totalCost", title: "Total Cost ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "revenue", title: "Revenue ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "netProfit", title: "Net Profit ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "marginPct", title: "Margin (%)", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      dataRows = [
        {
          id: "ORD-2026-0193",
          workOrderId: "WOOF-26-0356",
          customer: "Vanguard Fashion",
          product: "Luxury 600g Duplex Hangtag & VIP Business Card (Kashirovka 300g+300g)",
          materialCost: 618.4,
          processCost: 446.6,
          totalCost: 1065.0,
          revenue: 1680.0,
          netProfit: 615.0,
          marginPct: "36.6%",
          status: "High Margin",
        },
        {
          id: "CO-00041",
          workOrderId: "WOOF-26-0351",
          customer: "Alpha Media Group LLC",
          product: "A4 Hardcover Catalog 96p (Galerie Art Silk 150g + Soft-Touch)",
          materialCost: 6420.0,
          processCost: 3180.0,
          totalCost: 9600.0,
          revenue: 13258.93,
          netProfit: 3658.93,
          marginPct: "27.6%",
          status: "Completed",
        },
        {
          id: "CO-00042",
          workOrderId: "WOFL-26-0352",
          customer: "Nordic Print Co",
          product: "Woven Satin Labels 30×50mm (Rotary Flexo + Ultrasonic Cut)",
          materialCost: 1490.0,
          processCost: 980.0,
          totalCost: 2470.0,
          revenue: 4200.0,
          netProfit: 1730.0,
          marginPct: "41.2%",
          status: "High Margin",
        },
        {
          id: "CO-00043",
          workOrderId: "WO-00353",
          customer: "Baltic Press LLC",
          product: "Printed Nylon Taffeta Roll 40mm×200m",
          materialCost: 3120.0,
          processCost: 1640.0,
          totalCost: 4760.0,
          revenue: 6800.0,
          netProfit: 2040.0,
          marginPct: "30.0%",
          status: "Completed",
        },
        {
          id: "CO-00044",
          workOrderId: "WO-00354",
          customer: "Apex Packaging",
          product: "E-Flute Corrugated Packaging Boxes (4C UV + Die-Cut)",
          materialCost: 5840.0,
          processCost: 2610.0,
          totalCost: 8450.0,
          revenue: 11500.0,
          netProfit: 3050.0,
          marginPct: "26.5%",
          status: "Active",
        },
      ];
    }

    return { columns: cols, rows: dataRows };
  }, [type, clientSettlements]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchFilter, statusFilter]);

  useEffect(() => {
    const selectedRowsCount = selection.rows.length;
    let coords = "R1:C1";
    if (selection.current?.cell) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, filteredRows.length, coords);
  }, [selection, filteredRows.length, columns, updateGridStats]);

  const availableStatuses = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.status) s.add(r.status);
    });
    return Array.from(s);
  }, [rows]);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = filteredRows[row];
      if (!rowData) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const val = rowData[column.id as keyof typeof rowData];

      if (column.id === "status") {
        let color = isDark ? "#facc15" : "#a16207";
        if (val === "Settled" || val === "Completed" || val === "Active" || val === "High Margin") {
          color = isDark ? "#4ade80" : "#15803d";
        } else if (val === "Debt") {
          color = isDark ? "#f87171" : "#b91c1c";
        } else if (val === "Advance") {
          color = isDark ? "#60a5fa" : "#1d4ed8";
        }
        return {
          kind: GridCellKind.Text,
          data: String(val),
          displayData: String(val),
          allowOverlay: false,
          themeOverride: { textDark: color, baseFontStyle: "600 12px sans-serif" },
        };
      }

      if (typeof val === "number") {
        const isClosing = column.id === "closingBalance";
        const isProfit = column.id === "netProfit";
        const color = isClosing
          ? val > 0
            ? isDark
              ? "#f87171"
              : "#b91c1c"
            : val < 0
            ? isDark
              ? "#60a5fa"
              : "#1d4ed8"
            : isDark
            ? "#4ade80"
            : "#15803d"
          : isProfit
          ? isDark
            ? "#4ade80"
            : "#15803d"
          : undefined;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride:
            isClosing || isProfit
              ? { textDark: color, baseFontStyle: "700 12px monospace" }
              : undefined,
        };
      }

      return {
        kind: GridCellKind.Text,
        data: String(val ?? ""),
        displayData: String(val ?? ""),
        allowOverlay: false,
      };
    },
    [filteredRows, columns, isDark]
  );

  const handleOpenRow = (rowIndex: number) => {
    const row = filteredRows[rowIndex];
    if (!row) return;
    if (type === "settlements") {
      const matchedCust = crmCustomers.find(
        (c) =>
          c.name.toLowerCase() === String(row.customer).toLowerCase() ||
          c.name.toLowerCase().includes(String(row.customer).toLowerCase()) ||
          String(row.customer).toLowerCase().includes(c.name.toLowerCase()) ||
          c.tin === row.customerTin
      );
      const tabId = matchedCust?.id || row.id;
      openTab({
        id: tabId,
        title: `${tabId}: ${row.customer}`,
        type: "customer",
        module: "finance",
        activeLevel3Tab: "settlements",
        documentData: matchedCust || {
          id: tabId,
          name: row.customer,
          tin: row.customerTin,
          contractNo: row.contractNo,
        },
      });
      setLevel3Tab(tabId, "settlements");
    } else if (type === "cost-analysis") {
      openTab({
        id: row.id,
        title: `${row.id}: ${row.product}`,
        type: "work-order",
        module: "production",
        activeLevel3Tab: "financials",
        documentData: {
          docNo: row.id,
          customer: row.customer,
          product: row.product,
          status: "Approved",
          linkedWoId: row.workOrderId,
        },
      });
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedClient) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return;
    await recordPaymentAsync({
      customer: selectedClient.customer,
      amount: amt,
      note: paymentNote.trim() || undefined,
      contractNo: selectedClient.contractNo,
    });
    fetchPayments();
    setIsPaymentFormOpen(false);
    setPaymentNote("");
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
          {/* Toolbar */}
          <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              {type === "settlements" && (
                <Button
                  size="sm"
                  onClick={() => {
                    const idx = selection.rows.toArray()[0] ?? 0;
                    handleOpenRow(idx);
                  }}
                  className="h-7 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs gap-1 shadow-none rounded"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{tFin("reconciliationTitle")}</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = selection.rows.toArray()[0] ?? 0;
                  handleOpenRow(idx);
                }}
                className="h-7 px-2.5 text-xs font-medium gap-1 rounded"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>Open</span>
              </Button>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {availableStatuses.length > 0 && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      statusFilter === "ALL"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ALL
                  </button>
                  {availableStatuses.map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        statusFilter === st
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`${tCommon("search")}...`}
                  className="pl-7 h-7 text-xs bg-background border-input rounded"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>{tCommon("export")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 w-full h-full relative" id="finance-grid-root">
            <DataEditor
              getCellContent={getContent}
              onCellActivated={(cell) => handleOpenRow(cell[1])}
              columns={columns}
              rows={filteredRows.length}
              rowMarkers="both"
              freezeColumns={1}
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
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Akt Sverka (Client Reconciliation) Sheet */}
      <Sheet
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClientId(null);
            setIsPaymentFormOpen(false);
          }
        }}
      >
        <SheetContent className="sm:max-w-[540px] p-0 flex flex-col h-full bg-card text-xs">
          {selectedClient && (
            <>
              <div className="p-4 border-b border-border space-y-3 pr-10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SheetTitle className="text-sm font-bold">
                      {tFin("reconciliationTitle")}: {selectedClient.customer}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                      STIR: <span className="font-mono">{selectedClient.customerTin}</span> • Shartnoma: <span className="font-mono">{selectedClient.contractNo}</span>
                    </SheetDescription>
                  </div>
                  <Badge
                    className={
                      selectedClient.closingBalance > 0
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300"
                        : selectedClient.closingBalance < 0
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                    }
                  >
                    {selectedClient.closingBalance > 0
                      ? tFin("clientOwes")
                      : selectedClient.closingBalance < 0
                      ? tFin("advanceBalance")
                      : tFin("settled")}
                  </Badge>
                </div>

                {/* 4 Summary Tiles */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="bg-muted/50 border border-border rounded p-2">
                    <div className="text-[10px] text-muted-foreground">{tFin("openingBalance")}</div>
                    <div className="font-mono font-semibold text-xs mt-0.5">
                      ${selectedClient.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded p-2">
                    <div className="text-[10px] text-muted-foreground">{tFin("totalShipped")}</div>
                    <div className="font-mono font-semibold text-xs text-primary mt-0.5">
                      +${selectedClient.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded p-2">
                    <div className="text-[10px] text-muted-foreground">{tFin("totalPaid")}</div>
                    <div className="font-mono font-semibold text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      -${selectedClient.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded p-2">
                    <div className="text-[10px] text-muted-foreground">{tFin("closingBalance")}</div>
                    <div className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                      ${selectedClient.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsPaymentFormOpen((v) => !v)}
                    className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 flex-1 shadow-none"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{tFin("recordPayment")}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => typeof window !== "undefined" && window.print()}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{tCommon("print")}</span>
                  </Button>
                </div>

                {/* Quick Inline Payment Form */}
                {isPaymentFormOpen && (
                  <div className="bg-muted/60 border border-border rounded-md p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{tFin("paymentAmount")}</Label>
                        <Input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="h-7 text-xs font-mono bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{tFin("paymentNote")}</Label>
                        <Input
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          placeholder="Bank topshiriqnomasi №..."
                          className="h-7 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsPaymentFormOpen(false)}
                        className="h-7 text-xs"
                      >
                        {tCommon("cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleConfirmPayment}
                        className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{tFin("confirmPayment")}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chronological Ledger Entries */}
              <div className="flex-1 p-4 overflow-y-auto space-y-2">
                <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                  {tFin("chronology")}
                </div>

                <div className="space-y-1.5">
                  {selectedClient.ledger.map((entry) => {
                    const isSf = entry.docType === "Schet-faktura";
                    const isPay = entry.docType === "Payment";
                    return (
                      <div
                        key={entry.id}
                        className="border border-border rounded-md p-2.5 bg-background flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] px-1.5 py-0"
                            >
                              {entry.docNo}
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {entry.date}
                            </span>
                            {isSf && (
                              <button
                                onClick={() => {
                                  const act = deliveryActs.find((a) => a.id === entry.docNo);
                                  setSelectedClientId(null);
                                  openTab({
                                    id: entry.docNo,
                                    title: `${entry.docNo}: ${selectedClient.customer}`,
                                    type: "delivery-act",
                                    module: "sales",
                                    activeLevel3Tab: "overview",
                                    documentData: act || {
                                      id: entry.docNo,
                                      customer: selectedClient.customer,
                                      customerTin: selectedClient.customerTin,
                                      contractNo: selectedClient.contractNo,
                                      totalAmount: entry.debit,
                                    },
                                  });
                                }}
                                className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Ochish</span>
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-foreground truncate">
                            {entry.description}
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          {entry.debit > 0 && (
                            <div className="text-rose-600 dark:text-rose-400 font-semibold">
                              +${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <div className="text-[10px] text-muted-foreground font-sans">Debet (Yuk xati)</div>
                            </div>
                          )}
                          {isPay && entry.credit > 0 && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              -${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <div className="text-[10px] text-muted-foreground font-sans">Kredit (To'lov)</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ContextMenu>
  );
}
