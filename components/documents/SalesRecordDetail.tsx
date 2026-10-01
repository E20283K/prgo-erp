"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { SaleRecord } from "@/store/salesStore";
import {
  FileText,
  Printer,
  X,
  CreditCard,
  Banknote,
  Receipt,
  User,
  Package,
  Calendar,
  Clock,
  Building,
  CheckCircle2,
  DollarSign,
  ArrowLeft,
  Barcode,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

interface SalesRecordDetailProps {
  tab: DocumentTab;
}

export function SalesRecordDetail({ tab }: SalesRecordDetailProps) {
  const t = useTranslations("SalesHistory");
  const { closeTab, theme, setLevel3Tab } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLevel3Tab = tab.activeLevel3Tab || "overview";

  const sale: SaleRecord = useMemo(() => {
    if (tab.documentData && tab.documentData.items) {
      return tab.documentData as SaleRecord;
    }
    return {
      id: tab.id,
      timestamp: new Date().toISOString(),
      clientName: null,
      items: [
        { id: "SKU-8001", name: "Premium Cotton Polo (Navy)", price: 15.0, qty: 1 },
      ],
      subtotal: 15.0,
      discountAmount: 0,
      taxAmount: 1.5,
      total: 16.5,
      paymentMethod: "Cash",
      status: "Completed",
      cashier: "Alexey Kovalev",
      registerId: "POS-01",
    };
  }, [tab]);

  // Columns for the purchased items Glide Data Grid
  const columns: GridColumn[] = useMemo(() => [
    { id: "idx", title: "#", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "id", title: t("sku"), width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "name", title: t("productName"), width: 320, icon: GridColumnIcon.HeaderTextTemplate },
    { id: "price", title: `${t("unitPrice")} ($)`, width: 130, icon: GridColumnIcon.HeaderNumber },
    { id: "qty", title: t("qty"), width: 90, icon: GridColumnIcon.HeaderNumber },
    { id: "total", title: `${t("lineTotal")} ($)`, width: 140, icon: GridColumnIcon.HeaderNumber },
  ], [t]);

  const rows = useMemo(() => {
    return sale.items.map((item, idx) => ({
      idx: idx + 1,
      id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
      total: Number((item.price * item.qty).toFixed(2)),
    }));
  }, [sale]);

  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const rowData = rows[row];
    if (!rowData) {
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }

    const column = columns[col];
    const val = rowData[column.id as keyof typeof rowData];

    if (typeof val === "number") {
      return {
        kind: GridCellKind.Number,
        data: val,
        displayData: column.id === "idx" ? String(val) : val.toFixed(2),
        allowOverlay: false,
        contentAlign: column.id === "idx" ? "left" : "right",
      };
    }

    return {
      kind: GridCellKind.Text,
      data: String(val),
      displayData: String(val),
      allowOverlay: false,
      contentAlign: "left",
    };
  }, [rows, columns]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleTabChange = (val: string) => {
    setLevel3Tab(tab.id, val);
  };

  const totalUnits = useMemo(() => {
    return sale.items.reduce((acc, item) => acc + item.qty, 0);
  }, [sale]);

  const isB2B = Boolean(sale.clientName);
  const formattedDate = useMemo(() => {
    return new Date(sale.timestamp).toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [sale.timestamp]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground select-none overflow-hidden">
      {/* ── Level 2: Document Header & Command Toolbar (1C Enterprise Style) ── */}
      <div className="h-11 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h1 className="font-mono font-semibold text-sm tracking-tight text-foreground">
              {sale.id}
            </h1>
          </div>

          <Badge
            variant={
              sale.paymentMethod === "Cash"
                ? "default"
                : sale.paymentMethod === "Quote"
                ? "secondary"
                : "outline"
            }
            className={`text-[11px] font-semibold px-2 py-0.5 ${
              sale.paymentMethod === "Cash"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : sale.paymentMethod === "Debt"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {sale.paymentMethod === "Cash"
              ? `Cash • ${t("completed")}`
              : sale.paymentMethod === "Debt"
              ? `Debt • ${t("debt")}`
              : `Quote • ${t("quote")}`}
          </Badge>

          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {formattedDate}
          </span>
        </div>

        {/* Document Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{t("printReceipt")}</span>
          </Button>

          <Button
            onClick={() => closeTab(tab.id)}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded"
            title={t("close")}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Level 3: Document Tabs ── */}
      <Tabs
        value={activeLevel3Tab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border bg-muted/40 px-4 pt-1 shrink-0">
          <TabsList className="h-8 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="overview"
              className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-2 text-xs font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 shadow-none"
            >
              <Package className="w-3.5 h-3.5 mr-1.5" />
              {t("overview")}
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-2 text-xs font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 shadow-none"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              {t("paymentDetails")}
            </TabsTrigger>
            <TabsTrigger
              value="receipt"
              className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-2 text-xs font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 shadow-none"
            >
              <Barcode className="w-3.5 h-3.5 mr-1.5" />
              {t("receiptPreview")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── TAB 1: OVERVIEW & PRODUCTS ─── */}
        <TabsContent value="overview" className="flex-1 flex flex-col p-4 gap-4 overflow-hidden m-0">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
            {/* Buyer Card */}
            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {t("buyerInfo")}
              </div>
              <div className="font-semibold text-sm text-foreground mb-1">
                {sale.clientName || t("walkIn")}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{isB2B ? t("b2bClient") : t("retailWalkIn")}</span>
                <span>•</span>
                <span>{isB2B ? "Credit Account (Net 30)" : "Direct Retail"}</span>
              </div>
            </div>

            {/* Register & Operator Card */}
            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                {t("register")}
              </div>
              <div className="font-semibold text-sm text-foreground mb-1">
                {sale.registerId || "POS Terminal #1 (Central Store)"}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("cashier")}: <span className="font-medium text-foreground">{sale.cashier || "Alexey Kovalev"}</span>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                {t("financialBreakdown")}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">{t("total")}:</span>
                <span className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  ${sale.total.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex justify-between mt-1 pt-1 border-t border-border/50">
                <span>{sale.items.length} {sale.items.length === 1 ? "position" : "positions"}</span>
                <span>{totalUnits} {t("totalQty")}</span>
              </div>
            </div>
          </div>

          {/* Glide Data Grid for Purchased Products */}
          <div className="flex-1 flex flex-col bg-card border border-border rounded-md overflow-hidden min-h-0">
            <div className="h-8 px-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                {t("lineItems")} ({rows.length})
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {totalUnits} units total
              </span>
            </div>

            <div className="flex-1 w-full h-full relative">
              {mounted && (
                <DataEditor
                  getCellContent={getContent}
                  columns={columns}
                  rows={rows.length}
                  rowMarkers="both"
                  freezeColumns={1}
                  smoothScrollX={true}
                  smoothScrollY={true}
                  width="100%"
                  height="100%"
                  headerHeight={28}
                  rowHeight={30}
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: PAYMENT & FINANCIAL DETAILS ─── */}
        <TabsContent value="payment" className="flex-1 p-6 overflow-y-auto m-0">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                {t("paymentDetails")}
              </h2>
              <Separator />

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">{t("paymentMethod")}</span>
                  <Badge variant="outline" className="font-semibold text-xs px-2.5 py-1">
                    {sale.paymentMethod}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">{t("status")}</span>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{sale.status || t("completed")}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-1">{t("date")}</span>
                  <span className="font-mono text-foreground font-medium">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">{t("cashier")}</span>
                  <span className="text-foreground font-medium">{sale.cashier || "Alexey Kovalev"}</span>
                </div>
              </div>

              <Separator />

              {/* Financial Calculation List */}
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("subtotal")}</span>
                  <span>${sale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("discount")}</span>
                  <span className="text-destructive">-${sale.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("tax")} (10%)</span>
                  <span>+${sale.taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold text-foreground pt-1">
                  <span>{t("total")}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">${sale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 3: THERMAL RECEIPT PREVIEW ─── */}
        <TabsContent value="receipt" className="flex-1 p-6 overflow-y-auto m-0 flex justify-center bg-zinc-100/60 dark:bg-zinc-950">
          <div className="w-[360px] bg-white text-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md p-6 font-mono text-xs shadow-lg space-y-4">
            {/* Receipt Header */}
            <div className="text-center space-y-1 border-b border-dashed border-zinc-400 pb-4">
              <div className="font-bold text-sm tracking-wider">PRINTGOO ECOSYSTEM</div>
              <div className="text-[11px] text-zinc-600">CENTRAL PLANT & STORE #01</div>
              <div className="text-[10px] text-zinc-500">Tax ID: 94810481239</div>
              <div className="text-[10px] text-zinc-500">{formattedDate}</div>
            </div>

            {/* Receipt Metadata */}
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-zinc-400 pb-3">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold">{sale.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{sale.clientName || "Walk-in Client"}</span>
              </div>
              <div className="flex justify-between">
                <span>Operator:</span>
                <span>{sale.cashier || "Alexey Kovalev"}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 border-b border-dashed border-zinc-400 pb-3">
              {sale.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  <div className="font-medium">{item.name}</div>
                  <div className="flex justify-between text-zinc-600">
                    <span>{item.qty} x ${item.price.toFixed(2)}</span>
                    <span className="font-medium text-zinc-900">${(item.qty * item.price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Receipt Totals */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-400 pb-3">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal:</span>
                <span>${sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Discount:</span>
                  <span>-${sale.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>Tax (10%):</span>
                <span>${sale.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 text-zinc-950">
                <span>TOTAL:</span>
                <span>${sale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-600 pt-1">
                <span>Paid via:</span>
                <span className="font-semibold uppercase">{sale.paymentMethod}</span>
              </div>
            </div>

            {/* Barcode & Footer */}
            <div className="text-center space-y-2 pt-2">
              <div className="flex items-center justify-center py-1">
                <Barcode className="w-40 h-8 opacity-80" />
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Thank you for your business!
              </div>
              <Button
                onClick={handlePrint}
                size="sm"
                className="w-full h-8 bg-zinc-900 hover:bg-zinc-800 text-white text-xs gap-1.5 mt-2"
              >
                <Printer className="w-3.5 h-3.5" />
                {t("printReceipt")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
