"use client";

import React, { useCallback, useState, useMemo, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Plus,
  Download,
  Printer,
  Search,
  ExternalLink,
  Scale,
  Building2,
  FileText,
  Truck,
  Ship,
  Tag,
  Receipt,
  ShoppingBag,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  PackageCheck,
  CreditCard,
  Trash2,
  Activity,
  ChevronDown,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TradingGridProps {
  type: "sales" | "orders" | "ytt-limits" | "settlements" | "imports" | "catalog";
}

export function TradingGrid({ type }: TradingGridProps) {
  const tCommon = useTranslations("Common");
  const {
    theme,
    openTab,
    addNotification,
    updateGridStats,
    tradingSales,
    tradingOrders,
    tradingYttEntities,
    tradingImports,
    tradingCatalog,
    tradingSettlements,
    crmCustomers,
    loadCrmCustomers,
    isTradingLoading,
    loadTradingData,
    convertTradingOrderToSaleAsync,
    allocateTradingImportToStockAsync,
    deleteTradingSaleAsync,
    deleteTradingOrderAsync,
    deleteTradingCatalogItemAsync,
    recordTradingPaymentAsync,
  } = useWorkspaceStore();

  const isDark = theme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Payment Dialog state for Settlements
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(10_000_000);
  const [paymentSeller, setPaymentSeller] = useState("ytt-qodirov");
  const [paymentDocNo, setPaymentDocNo] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load real data from PostgreSQL on mount and when type changes
  useEffect(() => {
    loadTradingData(type);
    if (!crmCustomers || crmCustomers.length === 0) {
      loadCrmCustomers();
    }
    if (!tradingYttEntities || tradingYttEntities.length === 0) {
      loadTradingData("ytt-limits");
    }
  }, [type, loadTradingData, crmCustomers, loadCrmCustomers, tradingYttEntities]);

  // YTT Limit Status Filter state
  const [yttStatusFilter, setYttStatusFilter] = useState<"all" | "Safe" | "Warning" | "Critical">("all");

  // YTT Limits summary calculation
  const yttSummary = useMemo(() => {
    const list = tradingYttEntities || [];
    const yttOnly = list.filter((e) => e.legalType === "YTT");
    const totalLimit = yttOnly.reduce((sum, e) => sum + e.annualLimit, 0);
    const totalTurnover = yttOnly.reduce((sum, e) => sum + e.currentTurnover, 0);
    const totalRemaining = Math.max(0, totalLimit - totalTurnover);
    const overallPercent = totalLimit > 0 ? (totalTurnover / totalLimit) * 100 : 0;
    const safeCount = yttOnly.filter((e) => e.status === "Safe").length;
    const warningCount = yttOnly.filter((e) => e.status === "Warning").length;
    const criticalCount = yttOnly.filter((e) => e.status === "Critical").length;
    const recommended = yttOnly.find((e) => e.isRecommended) || yttOnly[0];

    return {
      totalEntities: list.length,
      totalLimitM: (totalLimit / 1_000_000).toFixed(0),
      totalTurnoverM: (totalTurnover / 1_000_000).toFixed(1),
      totalRemainingM: (totalRemaining / 1_000_000).toFixed(1),
      overallPercent: overallPercent.toFixed(1),
      safeCount,
      warningCount,
      criticalCount,
      recommended,
    };
  }, [tradingYttEntities]);

  // Columns & Rows configuration based on registry type
  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let rawRows: any[] = [];

    if (type === "sales") {
      cols = [
        { id: "docNo", title: "Hujjat №", width: 140, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "sellerEntityName", title: "Sotuvchi (YTT / MChJ)", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "customer", title: "Xaridor (Tekstil)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "totalAmountFormatted", title: "Jami Summa", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "currency", title: "Valyuta", width: 90, icon: GridColumnIcon.HeaderSingleValue },
        { id: "paymentMethod", title: "To'lov Shakli", width: 180, icon: GridColumnIcon.HeaderLookup },
        { id: "status", title: "Holat", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      ];
      rawRows = (tradingSales || []).map((s) => ({
        ...s,
        totalAmountFormatted:
          s.currency === "UZS"
            ? `${(Number(s.totalUZS) || Number(s.totalAmount) || 0).toLocaleString()} UZS`
            : `$${(Number(s.totalUSD) || 0).toFixed(2)} USD`,
      }));
    } else if (type === "orders") {
      cols = [
        { id: "orderNo", title: "Buyurtma №", width: 140, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Buyurtmachi (Tekstil)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "category", title: "Furnitura Turi", width: 160, icon: GridColumnIcon.HeaderSingleValue },
        { id: "totalFormatted", title: "Qiymat ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "chinaStatus", title: "Xitoy / Zavod Holati", width: 220, icon: GridColumnIcon.HeaderLookup },
        { id: "advanceStatus", title: "Avans Holati", width: 140, icon: GridColumnIcon.HeaderSingleValue },
        { id: "deliveryDate", title: "Yetkazish Muddat", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "trackingNo", title: "Kargo Treking", width: 140, icon: GridColumnIcon.HeaderString },
      ];
      rawRows = (tradingOrders || []).map((o) => ({
        ...o,
        totalFormatted: `$${(Number(o.totalUSD) || 0).toLocaleString()}`,
      }));
    } else if (type === "ytt-limits") {
      cols = [
        { id: "name", title: "YTT / Korxona Nomi", width: 260, icon: GridColumnIcon.HeaderString },
        { id: "legalType", title: "Tashkiliy Shakl", width: 110, icon: GridColumnIcon.HeaderSingleValue },
        { id: "inn", title: "INN", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "annualLimitFormatted", title: "Yillik Aylanma Limiti", width: 160, icon: GridColumnIcon.HeaderNumber },
        { id: "currentTurnoverFormatted", title: "Amaldagi Aylanma (2026)", width: 160, icon: GridColumnIcon.HeaderNumber },
        { id: "remainingQuotaFormatted", title: "Bo'sh Zaxira Kvotasi", width: 160, icon: GridColumnIcon.HeaderNumber },
        { id: "turnoverPercentFormatted", title: "Bandlik %", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "statusBadge", title: "Limit Holati", width: 140, icon: GridColumnIcon.HeaderSingleValue },
        { id: "recommendation", title: "Tizim Tavsiyasi", width: 160, icon: GridColumnIcon.HeaderLookup },
      ];
      rawRows = (tradingYttEntities || []).map((e) => {
        const remaining = Math.max(0, e.annualLimit - e.currentTurnover);
        return {
          ...e,
          annualLimitFormatted: e.annualLimit > 10_000_000_000 ? "Cheksiz (MChJ)" : `${(e.annualLimit / 1_000_000).toLocaleString()} mln UZS`,
          currentTurnoverFormatted: `${(e.currentTurnover / 1_000_000).toFixed(1)} mln UZS`,
          remainingQuotaFormatted: e.annualLimit > 10_000_000_000 ? "Cheksiz" : `${(remaining / 1_000_000).toFixed(1)} mln UZS`,
          turnoverPercentFormatted: e.annualLimit > 10_000_000_000 ? "—" : `${e.turnoverPercent.toFixed(1)}%`,
          statusBadge:
            e.status === "Safe"
              ? "Xavfsiz"
              : e.status === "Warning"
              ? "Diqqat"
              : e.status === "Critical"
              ? "LIMIT XAVFI"
              : "Cheksiz (QQS)",
          recommendation: e.isRecommended ? "Keyingi sotuvga tavsiya" : e.status === "Critical" ? "Bloklangan" : "Zaxirada",
        };
      });
    } else if (type === "settlements") {
      cols = [
        { id: "customer", title: "Mijoz (Tekstil Korxonasi)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "sellerEntityName", title: "Bizning Yuridik Shaxs", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "docNo", title: "Oxirgi Hujjat №", width: 140, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "debitFormatted", title: "Berilgan Tovar (Debet)", width: 150, icon: GridColumnIcon.HeaderNumber },
        { id: "creditFormatted", title: "Tushgan To'lov (Kredit)", width: 150, icon: GridColumnIcon.HeaderNumber },
        { id: "balanceFormatted", title: "Qoldiq Qarz (Saldo)", width: 160, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Akt-Sverka Holati", width: 150, icon: GridColumnIcon.HeaderSingleValue },
      ];
      rawRows = (tradingSettlements || []).map((l) => ({
        ...l,
        debitFormatted: l.currency === "UZS" ? `${(Number(l.debit) || 0).toLocaleString()} UZS` : `$${(Number(l.debit) || 0).toFixed(2)} USD`,
        creditFormatted: l.currency === "UZS" ? `${(Number(l.credit) || 0).toLocaleString()} UZS` : `$${(Number(l.credit) || 0).toFixed(2)} USD`,
        balanceFormatted: l.currency === "UZS" ? `${(Number(l.balance) || 0).toLocaleString()} UZS` : `$${(Number(l.balance) || 0).toFixed(2)} USD`,
        status: Number(l.balance) > 0 ? "Mijozdan qarz bor" : "Tenglashgan (0)",
      }));
    } else if (type === "imports") {
      cols = [
        { id: "batchNo", title: "Partiya №", width: 140, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "origin", title: "Yuk Jo'natilgan Joy", width: 170, icon: GridColumnIcon.HeaderString },
        { id: "supplier", title: "Xitoy Yetkazib Beruvchi", width: 240, icon: GridColumnIcon.HeaderString },
        { id: "fobAmountFormatted", title: "FOB Xarid ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "cargoFormatted", title: "Kargo / Transport ($)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "customsDutyFormatted", title: "Bojxona (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "markupFormatted", title: "Tannarxga Ustama", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "status", title: "Yuk Holati", width: 160, icon: GridColumnIcon.HeaderLookup },
      ];
      rawRows = (tradingImports || []).map((b) => ({
        ...b,
        fobAmountFormatted: `$${(Number(b.fobAmountUSD) || 0).toLocaleString()}`,
        cargoFormatted: `$${(Number(b.internationalCargoUSD) || 0).toLocaleString()}`,
        customsDutyFormatted: `${((Number(b.customsDutyUZS) || 0) / 1_000_000).toFixed(1)} mln UZS`,
        markupFormatted: `+${b.landedCostMarkupPercent}% (Landed)`,
      }));
    } else {
      // catalog
      cols = [
        { id: "sku", title: "Artikul", width: 130, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Aksessuar Nomi", width: 280, icon: GridColumnIcon.HeaderString },
        { id: "category", title: "Kategoriya", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "unit", title: "O'lchov Birligi", width: 90, icon: GridColumnIcon.HeaderString },
        { id: "priceUZSFormatted", title: "Sotuv Narxi (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "priceUSDFormatted", title: "Ekvivalent ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "stockQtyFormatted", title: "Ombor Qoldig'i", width: 130, icon: GridColumnIcon.HeaderNumber },
        { id: "origin", title: "Manba", width: 140, icon: GridColumnIcon.HeaderLookup },
      ];
      rawRows = (tradingCatalog || []).map((c) => ({
        ...c,
        id: c.sku,
        priceUZSFormatted: `${(Number(c.priceUZS) || 0).toLocaleString()} UZS`,
        priceUSDFormatted: `$${(Number(c.priceUSD) || 0).toFixed(3)}`,
        stockQtyFormatted: `${(Number(c.stockQty) || 0).toLocaleString()} ${c.unit}`,
      }));
    }

    // Filter by YTT status
    if (type === "ytt-limits" && yttStatusFilter !== "all") {
      rawRows = rawRows.filter((r) => r.status === yttStatusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rawRows = rawRows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    return { columns: cols, rows: rawRows };
  }, [
    type,
    searchQuery,
    yttStatusFilter,
    tradingSales,
    tradingOrders,
    tradingYttEntities,
    tradingSettlements,
    tradingImports,
    tradingCatalog,
  ]);

  // Keep Workspace Status Bar in sync
  useEffect(() => {
    const selectedRowsCount = gridSelection.rows.length;
    let coords = "R1:C1";
    if (gridSelection.current?.cell) {
      const [col, row] = gridSelection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, rows.length, coords);
  }, [gridSelection, rows.length, columns, updateGridStats]);

  // Glide Data Editor cell provider
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = rows[rowIndex];
      if (!row) return { kind: GridCellKind.Loading, allowOverlay: false };

      const col = columns[colIndex];
      const val = col?.id ? (row as any)[col.id] ?? "" : "";

      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: true,
        readonly: true,
      };
    },
    [columns, rows]
  );

  // Open document on double click
  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const row = rows[rowIndex];
      if (!row) return;

      if (type === "sales") {
        openTab({
          id: row.id || row.docNo || `TRD-${Date.now()}`,
          title: `${row.docNo || row.id} (${row.customer || "Tekstil"})`,
          type: "trading-sale",
          module: "trading",
          documentData: row,
        });
      } else if (type === "orders") {
        openTab({
          id: row.id || row.orderNo || `ORD-${Date.now()}`,
          title: `${row.orderNo || row.id} (${row.customer || "Tekstil"})`,
          type: "trading-order",
          module: "trading",
          documentData: row,
        });
      } else if (type === "settlements") {
        openTab({
          id: `stl-${(row.customer || "cust").replace(/[^a-zA-Z0-9]/g, "")}`,
          title: `${row.customer}`,
          type: "trading-settlement",
          module: "trading",
          documentData: row,
        });
      } else if (type === "imports") {
        openTab({
          id: row.id || row.batchNo || `imp-${Date.now()}`,
          title: `${row.batchNo || "Partiya"}`,
          type: "trading-import",
          module: "trading",
          documentData: row,
        });
      } else if (type === "catalog") {
        openTab({
          id: row.sku || row.id || `cat-${Date.now()}`,
          title: `${row.sku}: ${row.name}`,
          type: "trading-catalog",
          module: "trading",
          documentData: row,
        });
      } else if (type === "ytt-limits") {
        openTab({
          id: row.id || `ytt-${Date.now()}`,
          title: `${row.code || row.name}`,
          type: "trading-ytt-limit",
          module: "trading",
          documentData: row,
        });
      }
    },
    [openTab, rows, type]
  );

  const selectedRow = useMemo(() => {
    const firstRowIndex = gridSelection.rows.first();
    if (firstRowIndex !== undefined && rows[firstRowIndex]) {
      return rows[firstRowIndex];
    }
    return null;
  }, [gridSelection, rows]);

  // Convert Selected Order to Sale
  const handleConvertSelectedOrder = async () => {
    if (!selectedRow || type !== "orders") return;
    try {
      setIsActionLoading(true);
      const res = await convertTradingOrderToSaleAsync(selectedRow.id || selectedRow.orderNo);
      if (res) {
        addNotification({
          title: "Sotuv hujjati yaratildi",
          description: `Buyurtma ${selectedRow.orderNo} bo'yicha ${res.docNo} sotuv hujjati ochildi.`,
          severity: "success",
        });
        openTab({
          id: res.saleId,
          title: `${res.docNo} (${selectedRow.customer})`,
          type: "trading-sale",
          module: "trading",
          documentData: { id: res.saleId, docNo: res.docNo },
        });
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Buyurtmani sotuvga aylantirib bo'lmadi",
        severity: "error",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Allocate Selected Import Batch to Stock
  const handleAllocateSelectedImport = async () => {
    if (!selectedRow || type !== "imports") return;
    try {
      setIsActionLoading(true);
      const success = await allocateTradingImportToStockAsync(selectedRow.id);
      if (success) {
        addNotification({
          title: "Omborga kirim qilindi",
          description: `${selectedRow.batchNo} partiyasi to'liq tannarx bilan aksessuarlar katalogiga kirim qilindi.`,
          severity: "success",
        });
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Importni zaxiraga kirim qilib bo'lmadi",
        severity: "error",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Quick Payment submission
  const handleSavePayment = async () => {
    if (!paymentCustomer || !paymentAmount) return;
    try {
      setIsActionLoading(true);
      const success = await recordTradingPaymentAsync({
        sellerEntityId: paymentSeller,
        customer: paymentCustomer,
        amount: Number(paymentAmount),
        docNo: paymentDocNo || `PAY-TRD-${Date.now().toString().slice(-4)}`,
        notes: "Mijozdan to'lov qabul qilindi",
      });
      if (success) {
        setIsPaymentModalOpen(false);
        addNotification({
          title: "To'lov qayd etildi",
          description: `${paymentCustomer} hisobiga ${Number(paymentAmount).toLocaleString()} UZS to'lov kiritildi.`,
          severity: "success",
        });
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateNew = useCallback(() => {
    if (type === "orders") {
      const newId = `ORD-2026-${String(Math.floor(100 + Math.random() * 900))}`;
      openTab({
        id: newId,
        title: `${newId} (Yangi Buyurtma)`,
        type: "trading-order",
        module: "trading",
        isUnsaved: false,
        documentData: {
          id: newId,
          orderNo: newId,
          date: new Date().toISOString().split("T")[0],
          customer: "",
          contractNo: "",
          category: "Furnitura",
          deliveryDate: "",
          chinaStatus: "Navbatda",
          advanceStatus: "0% Kutilmoqda",
          advancePercent: 0,
          advanceAmountUSD: 0,
          totalUSD: 0,
          exchangeRate: 12850,
          shippingMethod: "Avto Fura Kargo (12-16 kun)",
          trackingNo: "",
          notes: "",
          items: [],
        },
      });
      return;
    }

    if (type === "imports") {
      const newId = `IMP-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
      openTab({
        id: newId,
        title: `${newId} (Yangi Import)`,
        type: "trading-import",
        module: "trading",
        isUnsaved: false,
        documentData: {
          id: newId,
          batchNo: newId,
          date: new Date().toISOString().split("T")[0],
          origin: "Guangzhou, Xitoy",
          supplier: "",
          fobAmountUSD: 0,
          internationalCargoUSD: 0,
          grossWeightKg: 0,
          customsDutyUZS: 0,
          exchangeRate: 12850,
          totalLandedCostUZS: 0,
          landedCostMarkupPercent: 0,
          status: "In Transit",
          containerNo: "",
          notes: "",
          items: [],
        },
      });
      return;
    }

    if (type === "catalog") {
      const newSku = `TRD-ACC-${String(Math.floor(100 + Math.random() * 900))}`;
      openTab({
        id: newSku,
        title: `${newSku} (Yangi Tovar)`,
        type: "trading-catalog",
        module: "trading",
        isUnsaved: false,
        documentData: {
          id: newSku,
          sku: newSku,
          name: "",
          category: "Tugmalar",
          unit: "dona",
          priceUZS: 0,
          priceUSD: 0,
          wholesalePriceUZS: 0,
          retailPriceUZS: 0,
          stockQty: 0,
          minStockLevel: 0,
          origin: "Guangzhou, Xitoy",
          material: "",
          colorCode: "",
          dimensions: "",
          supplier: "",
          notes: "",
        },
      });
      return;
    }

    const bestYtt = (tradingYttEntities || []).find((y) => y.isRecommended) || (tradingYttEntities && tradingYttEntities[0]);
    const newId = `TRD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    openTab({
      id: newId,
      title: `${newId} (Yangi Sotuv)`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: false,
      documentData: {
        id: newId,
        docNo: newId,
        date: new Date().toISOString().split("T")[0],
        sellerEntityId: bestYtt?.id || "ytt-qodirov",
        sellerEntityName: bestYtt?.name || "",
        sellerEntityInn: bestYtt?.inn || "",
        customer: "",
        customerTin: "",
        contractNo: "",
        currency: "UZS",
        exchangeRate: 12850,
        totalAmount: 0,
        totalUSD: 0,
        totalUZS: 0,
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Draft",
        notes: "",
        items: [],
      },
    });
  }, [type, openTab, tradingYttEntities]);

  // Keyboard shortcut: Ins to Create New
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Insert" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleCreateNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNew]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* 1C INDUSTRIAL HIGH-DENSITY TOOLBAR */}
      <div className="h-8 border-b border-border bg-card px-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink overflow-x-auto no-scrollbar">
          {type === "sales" && (
            <Button
              size="sm"
              onClick={handleCreateNew}
              className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tCommon("create")}</span>
            </Button>
          )}

          {type === "orders" && (
            <>
              <Button
                size="sm"
                onClick={handleCreateNew}
                className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tCommon("create")}</span>
              </Button>
              {selectedRow && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConvertSelectedOrder}
                  disabled={isActionLoading}
                  className="h-6.5 px-2 text-xs font-medium text-primary border-border hover:bg-muted flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>Sotuvga o'tkazish</span>
                </Button>
              )}
            </>
          )}

          {type === "imports" && (
            <>
              <Button
                size="sm"
                onClick={handleCreateNew}
                className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tCommon("create")}</span>
              </Button>
              {selectedRow && selectedRow.status !== "Allocated to Stock" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAllocateSelectedImport}
                  disabled={isActionLoading}
                  className="h-6.5 px-2 text-xs font-medium text-emerald-600 border-border hover:bg-muted flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <PackageCheck className="w-3 h-3" />
                  <span>Omborga kirim</span>
                </Button>
              )}
            </>
          )}

          {type === "catalog" && (
            <Button
              size="sm"
              onClick={handleCreateNew}
              className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tCommon("create")}</span>
            </Button>
          )}

          {type === "settlements" && (
            <Button
              size="sm"
              onClick={() => {
                setPaymentCustomer(selectedRow?.customer || "'REAL TEXTILE INVEST' MChJ");
                setIsPaymentModalOpen(true);
              }}
              className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>To'lov qabul</span>
            </Button>
          )}

          {type === "ytt-limits" && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 1. Status Filter Segment */}
              <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium shrink-0">
                {[
                  { id: "all", label: "Barchasi", count: (tradingYttEntities || []).length },
                  { id: "Safe", label: "Xavfsiz", count: yttSummary.safeCount, badgeClass: "text-emerald-700 dark:text-emerald-400" },
                  { id: "Warning", label: "Diqqat", count: yttSummary.warningCount, badgeClass: "text-amber-700 dark:text-amber-400" },
                  { id: "Critical", label: "Xavf", count: yttSummary.criticalCount, badgeClass: "text-red-700 dark:text-red-400 font-bold" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setYttStatusFilter(f.id as any)}
                    className={cn(
                      "px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0",
                      yttStatusFilter === f.id
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{f.label}</span>
                    <span className={cn("text-[10px] font-mono ml-0.5", f.badgeClass)}>
                      ({f.count})
                    </span>
                  </button>
                ))}
              </div>

              {/* 2. Compact Summary Popover */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6.5 px-2 text-xs gap-1.5 font-normal border-border bg-background shadow-none shrink-0 cursor-pointer"
                    />
                  }
                >
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {yttSummary.totalRemainingM}M zaxira
                  </span>
                  {yttSummary.criticalCount > 0 ? (
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                  )}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3 shadow-lg border border-border bg-popover z-50" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold text-xs text-foreground">YTT Aylanma Limiti Xulosasi</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {yttSummary.totalEntities} ta subyekt
                      </Badge>
                    </div>

                    {/* Overall capacity progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Umumiy bandlik</span>
                        <span className="font-mono font-semibold text-foreground">
                          {yttSummary.overallPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            Number(yttSummary.overallPercent) > 90
                              ? "bg-red-500"
                              : Number(yttSummary.overallPercent) > 75
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, Number(yttSummary.overallPercent))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-0.5">
                        <span>Ishlatildi: {yttSummary.totalTurnoverM}M</span>
                        <span>Bo&apos;sh: {yttSummary.totalRemainingM}M</span>
                      </div>
                    </div>

                    {/* Entities breakdown list */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Subyektlar taqsimoti
                      </span>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {(tradingYttEntities || []).map((ent) => {
                          const isMchj = ent.legalType === "MChJ";
                          const remainingM = (Math.max(0, ent.annualLimit - ent.currentTurnover) / 1_000_000).toFixed(0);
                          return (
                            <div
                              key={ent.id}
                              onClick={() => {
                                setSearchQuery(ent.code);
                              }}
                              className="p-1.5 rounded hover:bg-muted/60 transition-colors cursor-pointer border border-border/40 text-xs flex items-center justify-between gap-2"
                              title="Jadvalda qidirish uchun bosing"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-semibold text-[11px] text-foreground">
                                    {ent.code}
                                  </span>
                                  <span className="text-[11px] truncate text-muted-foreground">
                                    {ent.name}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {isMchj ? "Cheksiz (MChJ)" : `${remainingM}M bo'sh • ${ent.turnoverPercent.toFixed(1)}%`}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
                                  ent.status === "Safe"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : ent.status === "Warning"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                    : ent.status === "Critical"
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                                    : "bg-muted text-muted-foreground border-border"
                                )}
                              >
                                {ent.status === "Safe" ? "Xavfsiz" : ent.status === "Warning" ? "Diqqat" : ent.status === "Critical" ? "Xavf" : "Cheksiz"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* System Recommendation footer */}
                    {yttSummary.recommended && (
                      <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Tavsiya:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3 shrink-0" />
                          <span className="truncate max-w-[170px]">{yttSummary.recommended.code} ({yttSummary.recommended.name})</span>
                        </span>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Right side: Search, Refresh, Export, Print */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <div className="relative w-36 sm:w-44">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${tCommon("search")}...`}
              className="pl-7 h-6.5 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadTradingData(type)}
            disabled={isTradingLoading}
            className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            title={tCommon("refresh")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTradingLoading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6.5 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap cursor-pointer"
            onClick={() => {
              addNotification({
                title: "Excel eksport",
                description: "Reyestr ma'lumotlari Excel (XLSX) formatida tayyorlanmoqda.",
                severity: "info",
              });
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{tCommon("export")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            title={tCommon("print")}
            onClick={() => {
              addNotification({
                title: "Chop etish",
                description: "Reyestr PDF formatida tayyorlanmoqda.",
                severity: "info",
              });
            }}
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* GLIDE DATA GRID WORKSPACE */}
      <div className="flex-1 min-h-0 w-full relative">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="absolute inset-0">
              <DataEditor
                columns={columns}
                rows={rows.length}
                getCellContent={getCellContent}
                onCellActivated={handleCellActivated}
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
          </ContextMenuTrigger>
          <ContextMenuContent className="text-xs">
            <ContextMenuItem onClick={() => handleCellActivated([0, gridSelection.rows.first() ?? 0])}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              <span>Hujjatni ochish (F12)</span>
            </ContextMenuItem>
            {type === "orders" && selectedRow && (
              <ContextMenuItem onClick={handleConvertSelectedOrder}>
                <ArrowRight className="w-3.5 h-3.5 mr-2 text-sky-600" />
                <span>Sotuvga aylantirish</span>
              </ContextMenuItem>
            )}
            {type === "imports" && selectedRow && selectedRow.status !== "Allocated to Stock" && (
              <ContextMenuItem onClick={handleAllocateSelectedImport}>
                <PackageCheck className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                <span>Omborga kirim qilish</span>
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleCreateNew}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              <span>Yangi hujjat yaratish (Ins)</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* QUICK PAYMENT MODAL FOR SETTLEMENTS */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CreditCard className="size-4 text-emerald-600" />
              To'lov Qabul Qilish (Bank / Kassa)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Mijoz (Tekstil Korxonasi)</Label>
              <SmartCombobox
                value={paymentCustomer}
                onChange={(val) => setPaymentCustomer(val)}
                onAddNew={(newVal) => setPaymentCustomer(newVal)}
                options={(crmCustomers || []).map((c) => ({
                  value: c.name,
                  label: c.name,
                  description: c.tin ? `STIR: ${c.tin}` : undefined,
                  badge: c.status,
                }))}
                placeholder="Mijozni tanlang yoki kiriting..."
                searchPlaceholder="Mijoz nomi..."
                allowCustom={true}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">To'lov Summasi (UZS)</Label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={0}
                  value={paymentAmount}
                  onValueChange={(values) => setPaymentAmount(values.floatValue ?? 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Qabul qiluvchi YTT/MChJ</Label>
                <SmartCombobox
                  value={paymentSeller}
                  onChange={(val) => setPaymentSeller(val || "ytt-qodirov")}
                  options={(tradingYttEntities || []).map((ytt) => ({
                    value: ytt.id,
                    label: `${ytt.code}: ${ytt.name}`,
                    description: `STIR: ${ytt.inn || "—"}`,
                    badge: ytt.legalType,
                  }))}
                  placeholder="Sotuvchini tanlang..."
                  searchPlaceholder="Sotuvchini qidirish..."
                  allowCustom={false}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">To'lov Hujjati № (Platyojka)</Label>
              <Input
                placeholder="PP-2026-0981"
                value={paymentDocNo}
                onChange={(e) => setPaymentDocNo(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleSavePayment}
              disabled={isActionLoading || !paymentAmount}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Qayd etish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
