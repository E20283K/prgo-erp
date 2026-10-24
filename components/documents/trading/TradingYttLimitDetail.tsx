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
  Scale,
  Save,
  Check,
  Plus,
  Printer,
  Download,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Coins,
} from "lucide-react";
import { YttTurnoverLimitRecord, TradingSaleRecord } from "./types";
import { INITIAL_TRADING_SALES, INITIAL_YTT_ENTITIES } from "./data";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export interface YttInvoiceHistoryRow {
  id: string;
  docNo: string;
  date: string;
  customer: string;
  contractNo: string;
  amountUZS: number;
  amountUSD: number;
  currency: string;
  paymentMethod: string;
  status: string;
  itemsCount: number;
  cumulativeTurnoverUZS: number;
  limitPercentAfterDoc: number;
}

export function TradingYttLimitDetail({ tab }: { tab: DocumentTab }) {
  const {
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
    openTab,
    tradingSales,
    upsertYttEntityAsync,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<YttTurnoverLimitRecord> = tab.documentData || {};

  // Form State
  const [code] = useState<string>(rawData.code || "YTT-01");
  const [name, setName] = useState<string>(
    rawData.name || "YTT Qodirov Baxtiyor Shavkatovich"
  );
  const [legalType, setLegalType] = useState<"YTT" | "MChJ">(
    rawData.legalType || "YTT"
  );
  const [inn, setInn] = useState<string>(rawData.inn || "498213002");
  const [bankName, setBankName] = useState<string>(
    rawData.bankName || "AT 'Xalq Banki' Shayxontohur filiali"
  );
  const [bankAccount, setBankAccount] = useState<string>(
    rawData.bankAccount || "20218000500123456001"
  );
  const [annualLimit] = useState<number>(rawData.annualLimit || 1_000_000_000);
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Soliq qonunchiligi bo'yicha 1 mlrd UZS aylanmagacha soddalashtirilgan 4% aylanmadan soliq to'laydi."
  );

  // Invoices issued by this entity
  const invoiceHistory = useMemo<YttInvoiceHistoryRow[]>(() => {
    // Filter sales issued by this entity
    const matchingSales = INITIAL_TRADING_SALES.filter(
      (s) =>
        s.sellerEntityInn === inn ||
        s.sellerEntityName.toLowerCase().includes(name.toLowerCase().split(" ")[1] || "qodirov") ||
        s.sellerEntityId === tab.id
    );

    // If few, generate realistic historical distribution for the annual turnover
    let totalAccum = 0;
    const baseList: YttInvoiceHistoryRow[] = [
      {
        id: "TRD-2026-0842",
        docNo: "TRD-2026-0842",
        date: "2026-10-18",
        customer: "'REAL TEXTILE INVEST' MChJ",
        contractNo: "AK-2026/04",
        amountUZS: 47_300_000,
        amountUSD: 3680.93,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 3,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0841",
        docNo: "TRD-2026-0841",
        date: "2026-10-17",
        customer: "'BUKHARA COTTON WEAVE' XK",
        contractNo: "AK-2026/02",
        amountUZS: 18_500_000,
        amountUSD: 1439.69,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 2,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0810",
        docNo: "TRD-2026-0810",
        date: "2026-10-09",
        customer: "'SAMARKAND APPAREL' MChJ",
        contractNo: "AK-2026/01",
        amountUZS: 64_000_000,
        amountUSD: 4980.54,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 4,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0775",
        docNo: "TRD-2026-0775",
        date: "2026-09-28",
        customer: "'OSIYO TEKSTIL' MChJ",
        contractNo: "AK-2025/99",
        amountUZS: 82_400_000,
        amountUSD: 6412.45,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 5,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0712",
        docNo: "TRD-2026-0712",
        date: "2026-09-14",
        customer: "'ANDIJON IP-KALAVA' MChJ",
        contractNo: "AK-2026/18",
        amountUZS: 95_000_000,
        amountUSD: 7392.99,
        currency: "UZS",
        paymentMethod: "Corporate Card",
        status: "Posted",
        itemsCount: 2,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0640",
        docNo: "TRD-2026-0640",
        date: "2026-08-20",
        customer: "'GLOBAL APPAREL INVEST' MChJ",
        contractNo: "AK-2026/09",
        amountUZS: 120_000_000,
        amountUSD: 9338.52,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 6,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
      {
        id: "TRD-2026-0520",
        docNo: "TRD-2026-0520",
        date: "2026-07-15",
        customer: "'CHIRCHIQ MEGA TEKSTIL' XK",
        contractNo: "AK-2026/05",
        amountUZS: 160_300_000,
        amountUSD: 12474.7,
        currency: "UZS",
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Posted",
        itemsCount: 7,
        cumulativeTurnoverUZS: 0,
        limitPercentAfterDoc: 0,
      },
    ];

    // Compute running turnover backwards or forwards
    const current = rawData.currentTurnover || 587_500_000;
    let running = current;
    return baseList.map((row, idx) => {
      const snap = running;
      running = Math.max(0, running - row.amountUZS);
      return {
        ...row,
        cumulativeTurnoverUZS: snap,
        limitPercentAfterDoc: annualLimit > 0 ? (snap / annualLimit) * 100 : 0,
      };
    });
  }, [inn, name, tab.id, rawData.currentTurnover, annualLimit]);

  // Current calculations
  const currentTurnover = rawData.currentTurnover || 587_500_000;
  const remainingQuota = Math.max(0, annualLimit - currentTurnover);
  const percentUsed = annualLimit > 0 && legalType === "YTT" ? (currentTurnover / annualLimit) * 100 : 0;

  const statusType: "Safe" | "Warning" | "Critical" | "Unlimited" =
    legalType === "MChJ"
      ? "Unlimited"
      : percentUsed > 95
      ? "Critical"
      : percentUsed > 80
      ? "Warning"
      : "Safe";

  // ─── Glide Data Grid Configuration ───────────────────────────────────────────
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "docNo", title: "Hisob-faktura / Realizatsiya №", width: 220, icon: GridColumnIcon.HeaderReference },
      { id: "customer", title: "Xaridor (Tekstil Korxonasi)", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "contractNo", title: "Shartnoma", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "amountUZS", title: "Faktura Summasi (UZS)", width: 170, icon: GridColumnIcon.HeaderNumber },
      { id: "amountUSD", title: "Ekvivalent ($)", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "cumulativeTurnoverUZS", title: "Ushbu Hujjatdan Keyingi Aylanma", width: 220, icon: GridColumnIcon.HeaderNumber },
      { id: "limitPercentAfterDoc", title: "Limit Bandligi", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "paymentMethod", title: "To'lov Shakli", width: 190, icon: GridColumnIcon.HeaderLookup },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = invoiceHistory[rowIndex];
      const col = columns[colIndex];
      if (!row || !col) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (col.id === "date" || col.id === "customer" || col.id === "contractNo" || col.id === "paymentMethod") {
        const val = String((row as any)[col.id] || "");
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          readonly: true,
          themeOverride: col.id === "date" ? { baseFontStyle: "11px monospace" } : undefined,
        };
      }

      if (col.id === "docNo") {
        return {
          kind: GridCellKind.Text,
          data: row.docNo,
          displayData: row.docNo,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "amountUZS") {
        return {
          kind: GridCellKind.Number,
          data: row.amountUZS,
          displayData: `${row.amountUZS.toLocaleString()} UZS`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#34d399" : "#059669",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "amountUSD") {
        return {
          kind: GridCellKind.Number,
          data: row.amountUSD,
          displayData: `$${row.amountUSD.toFixed(2)}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#94a3b8" : "#64748b",
            baseFontStyle: "11px monospace",
          },
        };
      }

      if (col.id === "cumulativeTurnoverUZS") {
        return {
          kind: GridCellKind.Number,
          data: row.cumulativeTurnoverUZS,
          displayData: `${row.cumulativeTurnoverUZS.toLocaleString()} UZS`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "limitPercentAfterDoc") {
        const pct = row.limitPercentAfterDoc;
        const color =
          pct > 95
            ? isDark ? "#f87171" : "#dc2626"
            : pct > 80
            ? isDark ? "#fbbf24" : "#d97706"
            : isDark ? "#34d399" : "#059669";
        return {
          kind: GridCellKind.Text,
          data: `${pct.toFixed(1)}%`,
          displayData: `${pct.toFixed(1)}%`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [columns, invoiceHistory, isDark]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const row = invoiceHistory[rowIndex];
      if (!row) return;

      openTab({
        id: row.docNo,
        title: `${row.docNo} (${row.customer})`,
        type: "trading-sale",
        module: "trading",
        documentData: {
          id: row.docNo,
          docNo: row.docNo,
          date: row.date,
          sellerEntityId: tab.id,
          sellerEntityName: name,
          customer: row.customer,
          contractNo: row.contractNo,
          currency: "UZS",
          exchangeRate: 12850,
          totalAmount: row.amountUZS,
          totalUSD: row.amountUSD,
          totalUZS: row.amountUZS,
          status: "Posted",
        },
      });
    },
    [invoiceHistory, openTab, name, tab.id]
  );

  const handleCreateNewSaleForEntity = () => {
    if (statusType === "Critical") {
      alert("Diqqat! Ushbu YTT yillik 1 mlrd UZS limitiga deyarli yetgan (98%). Yangi sotuv boshqa YTT orqali amalga oshirilishi shart!");
      return;
    }

    const newSaleId = `TRD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    openTab({
      id: newSaleId,
      title: `${newSaleId} (${code})`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: false,
      documentData: {
        id: newSaleId,
        docNo: newSaleId,
        date: new Date().toISOString().split("T")[0],
        sellerEntityId: tab.id,
        sellerEntityName: name,
        sellerEntityInn: inn,
        customer: "'REAL TEXTILE INVEST' MChJ",
        customerTin: "304891234",
        contractNo: "AK-2026/04",
        currency: "UZS",
        exchangeRate: 12850,
        totalAmount: 0,
        totalUSD: 0,
        totalUZS: 0,
        paymentMethod: "Bank Wire (Hisob-raqam)",
        status: "Draft",
        items: [],
      },
    });
  };

  const handleSave = async () => {
    const payload: Partial<YttTurnoverLimitRecord> = {
      id: rawData.id && !rawData.id.startsWith("draft-") ? rawData.id : undefined,
      code,
      name,
      legalType,
      inn,
      bankName,
      bankAccount,
      annualLimit,
      currentTurnover: currentTurnover,
      status: statusType,
      notes,
    };
    await upsertYttEntityAsync(payload);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "YTT ma'lumotlari saqlandi",
      description: `${name} yuridik rekvizitlari va bank ma'lumotlari bazaga muvaffaqiyatli saqlandi.`,
      severity: "success",
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header (Emerald / Tax Meter Style) */}
      <DocumentHeader
        icon={Scale}
        title={`YTT Soliq Aylanma Limiti Nazorati: ${name}`}
        docNo={code}
        date="2026 Moliya Yili"
        status={statusType === "Critical" ? "Critical" : statusType === "Warning" ? "Warning" : "Active"}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addNotification({
                  title: "Soliq hisoboti PDF",
                  description: `${name} soliq tahlili va realizatsiya reestri PDF formatida tayyorlanmoqda.`,
                  severity: "info",
                });
              }}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Chop etish (PDF)</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Saqlash</span>
            </Button>

            <Button
              size="sm"
              onClick={handleCreateNewSaleForEntity}
              disabled={statusType === "Critical"}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi Sotuv Hujjati Yaratish</span>
            </Button>
          </>
        }
      />

      {/* SINGLE-PAGE DASHBOARD AT TOP */}
      <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5">
        {/* TOP KPI CARDS: LIMIT, CURRENT TURNOVER, REMAINING, STATUS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Card 1: Yillik Limit */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Yillik Soliq Limiti:</span>
            <div className="text-sm font-mono font-bold text-foreground">
              {legalType === "YTT" ? "1,000,000,000 UZS" : "Cheklanmagan (QQS)"}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {legalType === "YTT" ? "1.0 mlrd UZS (4% soddalashtirilgan soliq)" : "12% QQS tizimi"}
            </span>
          </div>

          {/* Card 2: Amaldagi Aylanma */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">2026-yilgi Jami Aylanma:</span>
            <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
              {(currentTurnover / 1_000_000).toFixed(1)} mln UZS
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Ekvivalent: ~${(currentTurnover / 12850).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
            </span>
          </div>

          {/* Card 3: Bo'sh Zaxira Kvotasi */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Bo&apos;sh Qolgan Kvota:</span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 h-3.5 ${
                  statusType === "Critical"
                    ? "bg-red-50 text-red-700 border-red-300 font-bold"
                    : statusType === "Warning"
                    ? "bg-amber-50 text-amber-700 border-amber-300 font-bold"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                }`}
              >
                {legalType === "YTT" ? `${percentUsed.toFixed(1)}% band` : "QQS"}
              </Badge>
            </div>
            <div className={`text-sm font-mono font-bold ${
              statusType === "Critical" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {legalType === "YTT" ? `${(remainingQuota / 1_000_000).toFixed(1)} mln UZS` : "Cheklov yo'q"}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {statusType === "Critical"
                ? "Diqqat: Yangi sotuv taqiqlanadi!"
                : "Ushbu YTT orqali realizatsiya mumkin"}
            </span>
          </div>

          {/* Card 4: Yuridik Maqom va INN */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Tashkiliy Shakl & INN:</span>
            <div className="text-xs font-semibold text-foreground truncate" title={name}>
              {legalType} • INN: {inn}
            </div>
            <span className="text-[10px] text-muted-foreground truncate block" title={bankName}>
              {bankName}
            </span>
          </div>
        </div>

        {/* PROGRESS BAR (VISUAL LIMIT RUNNER) */}
        {legalType === "YTT" && (
          <div className="p-2.5 rounded border border-border bg-muted/30 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>Yillik 1 mlrd aylanma chegarasiga masofa:</span>
              </span>
              <span className="font-mono font-bold text-foreground">
                {(currentTurnover / 1_000_000).toFixed(1)} mln / 1,000 mln UZS ({percentUsed.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentUsed > 95
                    ? "bg-red-500"
                    : percentUsed > 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, percentUsed)}%` }}
              />
            </div>
          </div>
        )}

        {/* EDITABLE REQUISITES ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">YTT To&apos;liq F.I.SH / Nomi:</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTabUnsaved(tab.id, true);
              }}
              className="h-7 text-xs mt-0.5"
            />
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Soliq To&apos;lovchi INN:</Label>
            <Input
              value={inn}
              onChange={(e) => {
                setInn(e.target.value);
                setTabUnsaved(tab.id, true);
              }}
              className="h-7 text-xs font-mono mt-0.5"
            />
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Xizmat Ko&apos;rsatuvchi Bank:</Label>
            <Input
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                setTabUnsaved(tab.id, true);
              }}
              className="h-7 text-xs mt-0.5"
            />
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Hisob-raqam (20 xona):</Label>
            <Input
              value={bankAccount}
              onChange={(e) => {
                setBankAccount(e.target.value);
                setTabUnsaved(tab.id, true);
              }}
              className="h-7 text-xs font-mono mt-0.5"
            />
          </div>
        </div>
      </div>

      {/* INDUSTRIAL ACTION TOOLBAR FOR REALIZATION HISTORY */}
      <div className="px-3 h-9 border-b border-border bg-card shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-xs text-foreground">
            Ushbu YTT Orqali Chiqarilgan Sotuv Hujjatlari va Hisob-fakturalar Reestri
          </span>
          <Badge variant="secondary" className="font-mono text-[10px] h-5">
            {invoiceHistory.length} ta hisob-faktura
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono">
            Aylanma: <strong className="text-foreground">{currentTurnover.toLocaleString()} UZS</strong>
          </span>
          <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
            (Ikkita marta bosing: Sotuv hisob-fakturasini ochish)
          </span>
        </div>
      </div>

      {/* GLIDE DATA GRID: ENTIRE LOWER VIEWPORT */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <DataEditor
            columns={columns}
            rows={invoiceHistory.length}
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
      </div>
    </div>
  );
}
