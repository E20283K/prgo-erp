"use client";

import React, { useCallback, useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import {
  INITIAL_YTT_ENTITIES,
  INITIAL_TRADING_SALES,
  INITIAL_IMPORT_BATCHES,
  INITIAL_SETTLEMENT_LEDGERS,
  INITIAL_TRADING_CATALOG,
} from "@/components/documents/trading/data";
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
  const { theme, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Columns & Mock Rows configuration based on registry type
  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let rawRows: any[] = [];

    if (type === "sales") {
      cols = [
        { id: "id", title: "Hujjat №", width: 130, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "sellerEntityName", title: "Sotuvchi (YTT / MChJ)", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "customer", title: "Xaridor (Tekstil)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "totalAmountFormatted", title: "Jami Summa", width: 140, icon: GridColumnIcon.HeaderNumber },
        { id: "currency", title: "Valyuta", width: 90, icon: GridColumnIcon.HeaderSingleValue },
        { id: "paymentMethod", title: "To'lov Shakli", width: 180, icon: GridColumnIcon.HeaderLookup },
        { id: "status", title: "Holat", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      ];
      rawRows = INITIAL_TRADING_SALES.map((s) => ({
        ...s,
        totalAmountFormatted:
          s.currency === "UZS"
            ? `${s.totalUZS.toLocaleString()} UZS`
            : `$${s.totalUSD.toFixed(2)} USD`,
      }));
    } else if (type === "orders") {
      cols = [
        { id: "id", title: "Buyurtma №", width: 120, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Buyurtmachi (Tekstil)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "category", title: "Furnitura Turi", width: 150, icon: GridColumnIcon.HeaderSingleValue },
        { id: "qtyFormatted", title: "Miqdor", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "chinaStatus", title: "Xitoy Buyurtmasi (Back-to-back)", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "advancePaid", title: "Avans Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "deliveryDate", title: "Yetkazish Muddat", width: 120, icon: GridColumnIcon.HeaderDate },
      ];
      rawRows = [
        {
          id: "ORD-ACC-091",
          date: "2026-10-18",
          customer: "'REAL TEXTILE INVEST' MChJ",
          category: "Gravirovka Tugmalar (18mm)",
          qtyFormatted: "50,000 dona",
          chinaStatus: "Guangzhou Zavodida Ishlab Chiqarilmoqda",
          advancePaid: "30% Avans Olingan",
          deliveryDate: "2026-11-05",
        },
        {
          id: "ORD-ACC-089",
          date: "2026-10-16",
          customer: "'BUKHARA COTTON WEAVE' XK",
          category: "Neylon Fermuarlar N5",
          qtyFormatted: "30,000 dona",
          chinaStatus: "Kargo Avto Yo'lda (CN-2026-OCT-14)",
          advancePaid: "100% To'langan",
          deliveryDate: "2026-10-25",
        },
        {
          id: "ORD-ACC-084",
          date: "2026-10-14",
          customer: "'SAMARKAND APPAREL' MChJ",
          category: "Metall Fermuarlar (Jinsi)",
          qtyFormatted: "20,000 dona",
          chinaStatus: "Ombordan Zaxiradan Ajratildi",
          advancePaid: "Shartnoma Bo'yicha",
          deliveryDate: "2026-10-20",
        },
      ];
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
      rawRows = INITIAL_YTT_ENTITIES.map((e) => {
        const remaining = Math.max(0, e.annualLimit - e.currentTurnover);
        return {
          ...e,
          annualLimitFormatted: e.annualLimit > 10_000_000_000 ? "Cheksiz (MChJ)" : `${(e.annualLimit / 1_000_000).toLocaleString()} mln UZS`,
          currentTurnoverFormatted: `${(e.currentTurnover / 1_000_000).toFixed(1)} mln UZS`,
          remainingQuotaFormatted: e.annualLimit > 10_000_000_000 ? "Cheksiz" : `${(remaining / 1_000_000).toFixed(1)} mln UZS`,
          turnoverPercentFormatted: e.annualLimit > 10_000_000_000 ? "—" : `${e.turnoverPercent.toFixed(1)}%`,
          statusBadge:
            e.status === "Safe"
              ? "✓ Xavfsiz (58%)"
              : e.status === "Warning"
              ? "⚠ Diqqat (85%)"
              : e.status === "Critical"
              ? "⛔ LIMIT XAVFI (98%)"
              : "Cheksiz (QQS)",
          recommendation: e.isRecommended ? "★ Keyingi sotuvga tavsiya" : e.status === "Critical" ? "Bloklangan" : "Zaxirada",
        };
      });
    } else if (type === "settlements") {
      cols = [
        { id: "customer", title: "Mijoz (Tekstil Korxonasi)", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "sellerEntityName", title: "Bizning Yuridik Shaxs", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "docNo", title: "Oxirgi Hujjat №", width: 130, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
        { id: "debitFormatted", title: "Berilgan Tovar (Debet)", width: 150, icon: GridColumnIcon.HeaderNumber },
        { id: "creditFormatted", title: "Tushgan To'lov (Kredit)", width: 150, icon: GridColumnIcon.HeaderNumber },
        { id: "balanceFormatted", title: "Qoldiq Qarz (Saldo)", width: 160, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Akt-Sverka Holati", width: 150, icon: GridColumnIcon.HeaderSingleValue },
      ];
      rawRows = INITIAL_SETTLEMENT_LEDGERS.map((l) => ({
        ...l,
        debitFormatted: l.currency === "UZS" ? `${l.debit.toLocaleString()} UZS` : `$${l.debit.toFixed(2)} USD`,
        creditFormatted: l.currency === "UZS" ? `${l.credit.toLocaleString()} UZS` : `$${l.credit.toFixed(2)} USD`,
        balanceFormatted: l.currency === "UZS" ? `${l.balance.toLocaleString()} UZS` : `$${l.balance.toFixed(2)} USD`,
        status: l.balance > 0 ? "Mijozdan qarz bor" : "Tenglashgan (0)",
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
      rawRows = INITIAL_IMPORT_BATCHES.map((b) => ({
        ...b,
        fobAmountFormatted: `$${b.fobAmountUSD.toLocaleString()}`,
        cargoFormatted: `$${b.internationalCargoUSD.toLocaleString()}`,
        customsDutyFormatted: `${(b.customsDutyUZS / 1_000_000).toFixed(1)} mln UZS`,
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
        { id: "stockQty", title: "Ombor Qoldig'i", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "origin", title: "Manba", width: 140, icon: GridColumnIcon.HeaderLookup },
      ];
      rawRows = INITIAL_TRADING_CATALOG.map((c) => ({
        ...c,
        id: c.sku,
        priceUZSFormatted: `${c.priceUZS.toLocaleString()} UZS`,
        priceUSDFormatted: `$${c.priceUSD.toFixed(3)}`,
        stockQty: `${c.stockQty.toLocaleString()} ${c.unit}`,
      }));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rawRows = rawRows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    return { columns: cols, rows: rawRows };
  }, [type, searchQuery]);

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

      if (type === "sales" || type === "orders") {
        openTab({
          id: row.id || `TRD-${Date.now()}`,
          title: `${row.id || "Sotuv Hujjati"} (${row.customer || "Tekstil"})`,
          type: "trading-sale",
          module: "trading",
          documentData: row,
        });
      } else if (type === "settlements") {
        openTab({
          id: `stl-${row.customer.replace(/[^a-zA-Z0-9]/g, "")}`,
          title: `Akt-Sverka: ${row.customer}`,
          type: "trading-settlement",
          module: "trading",
          documentData: row,
        });
      } else if (type === "imports") {
        openTab({
          id: row.batchNo || row.id || `imp-${Date.now()}`,
          title: `Import: ${row.batchNo}`,
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
      }
    },
    [openTab, rows, type]
  );

  const handleCreateNew = () => {
    const newId = `TRD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    openTab({
      id: newId,
      title: `${newId} (Yangi Sotuv)`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: true,
      documentData: {
        id: newId,
        docNo: newId,
        date: new Date().toISOString().split("T")[0],
        sellerEntityId: "ytt-qodirov",
        sellerEntityName: "YTT Qodirov Baxtiyor Shavkatovich",
        sellerEntityInn: "498213002",
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

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* 1C INDUSTRIAL HIGH-DENSITY TOOLBAR */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-card shrink-0 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {type === "sales" && (
            <Button
              size="sm"
              onClick={handleCreateNew}
              className="h-7 px-2.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi Sotuv Hujjati (Ins)</span>
            </Button>
          )}

          {type === "ytt-limits" && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[11px] gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>YTT Qodirov: 58.7% (Bo'sh: 412.5 mln)</span>
              </Badge>
              <Badge variant="outline" className="h-6 bg-amber-50 text-amber-800 border-amber-300 font-mono text-[11px] gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>YTT Aliyev: 85.2%</span>
              </Badge>
              <Badge variant="outline" className="h-6 bg-red-50 text-red-800 border-red-300 font-mono text-[11px] gap-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>YTT Toshmatov: 98.1% (XAVFLI)</span>
              </Badge>
            </div>
          )}

          <div className="relative max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qidirish (Nomer, INN, Mijoz)..."
              className="h-7 pl-7 text-xs bg-muted/40 font-mono"
            />
          </div>

          <Separator orientation="vertical" className="h-4 bg-border" />
          <span className="text-[11px] text-muted-foreground font-mono">
            {rows.length} ta yozuv
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => {
              useWorkspaceStore.getState().addNotification({
                title: "Excel eksport",
                description: "Reyestr ma'lumotlari Excel (XLSX) formatida yuklab olinmoqda.",
                severity: "info",
              });
            }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            onClick={() => {
              useWorkspaceStore.getState().addNotification({
                title: "Chop etish",
                description: "Reyestr PDF formatida tayyorlanmoqda.",
                severity: "info",
              });
            }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Chop etish</span>
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
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleCreateNew}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              <span>Yangi hujjat yaratish (Ins)</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}
