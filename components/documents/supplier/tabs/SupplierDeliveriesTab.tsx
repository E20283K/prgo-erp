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
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  PackageCheck,
  ExternalLink,
  Copy,
  Layers,
  Info,
} from "lucide-react";
import type { SupplierRecord } from "@/lib/server/supplierService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface SupplierDeliveriesTabProps {
  supplier: SupplierRecord;
}

export function SupplierDeliveriesTab({ supplier }: SupplierDeliveriesTabProps) {
  const { warehouseReceipts, openTab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  // Filter matched warehouse receipts
  const matchedReceipts = useMemo(() => {
    return (warehouseReceipts || []).filter((r: any) => {
      const suppName = (r.supplierName || "").toLowerCase();
      const sName = (supplier.name || "").toLowerCase();
      const sLegal = (supplier.legalName || "").toLowerCase();
      return (
        suppName &&
        (suppName.includes(sName) ||
          (sLegal && suppName.includes(sLegal)) ||
          sName.includes(suppName))
      );
    });
  }, [warehouseReceipts, supplier.name, supplier.legalName]);

  const curr = supplier.currency || "UZS";

  // Summary statistics
  const totalAmount = useMemo(() => {
    return matchedReceipts.reduce((sum: number, r: any) => sum + (Number(r.totalAmount) || 0), 0);
  }, [matchedReceipts]);

  // Columns definition
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "idx", title: "№", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "receiptNumber", title: "Kirim №", width: 130, icon: GridColumnIcon.HeaderReference },
    { id: "receiptDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
    { id: "locationName", title: "Ombor / Sektor", width: 170, icon: GridColumnIcon.HeaderSingleValue },
    { id: "items", title: "Qabul qilingan materiallar / Spetsifikatsiya", width: 400, icon: GridColumnIcon.HeaderString },
    { id: "receivedBy", title: "Qabul qildi", width: 140, icon: GridColumnIcon.HeaderString },
    { id: "totalAmount", title: `Summasi (${curr})`, width: 155, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
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
      const item = matchedReceipts[row];
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

      if (column.id === "receiptNumber") {
        const docNo = item.receiptNumber || item.id;
        return {
          kind: GridCellKind.Text,
          data: docNo,
          displayData: docNo,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (column.id === "receiptDate") {
        const d = item.receiptDate ? String(item.receiptDate).split("T")[0] : "-";
        return {
          kind: GridCellKind.Text,
          data: d,
          displayData: d,
          allowOverlay: false,
        };
      }

      if (column.id === "locationName") {
        const loc = item.locationName || "Asosiy Xomashyo Ombori";
        return {
          kind: GridCellKind.Text,
          data: loc,
          displayData: loc,
          allowOverlay: false,
        };
      }

      if (column.id === "items") {
        const itemsStr =
          item.items && item.items.length > 0
            ? item.items.map((it: any) => `${it.name} (${it.quantity} ${it.unit})`).join(", ")
            : "Xomashyo va materiallar";
        return {
          kind: GridCellKind.Text,
          data: itemsStr,
          displayData: itemsStr,
          allowOverlay: false,
        };
      }

      if (column.id === "receivedBy") {
        const who = item.receivedBy || "Omborchi";
        return {
          kind: GridCellKind.Text,
          data: who,
          displayData: who,
          allowOverlay: false,
        };
      }

      if (column.id === "totalAmount") {
        const val = Number(item.totalAmount) || 0;
        const display = `${val.toLocaleString("uz-UZ")} ${curr}`;
        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        const st = item.status || "Accepted";
        return {
          kind: GridCellKind.Text,
          data: st,
          displayData: st === "Accepted" ? "Qabul qilindi" : st,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            textDark: isDark ? "#4ade80" : "#15803d",
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: false,
      };
    },
    [matchedReceipts, columns, isDark, curr]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const receipt = matchedReceipts[row];
      if (!receipt) return;

      openTab({
        id: receipt.id,
        title: `${receipt.receiptNumber || receipt.id}: Kirim`,
        type: "warehouse-receipt",
        module: "warehouse",
        documentData: receipt,
      });
    },
    [matchedReceipts, openTab]
  );

  const selectedReceipt = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return null;
    return matchedReceipts[selectedRows[0]] || null;
  }, [selection, matchedReceipts]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* 1. Header Toolbar & Quick KPI Strip */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Yetkazilgan Kirimlar
            </div>
            <div className="text-xs font-bold">
              {matchedReceipts.length} ta hujjat
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Qabul Qilingan Summa
            </div>
            <div className="font-mono text-xs font-bold text-foreground">
              {totalAmount.toLocaleString("uz-UZ")} {curr}
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              Omborga qabul qilingan xomashyolar (qog&apos;oz, bo&apos;yoq) va sexga topshirilgan buyurtmalar.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedReceipt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                openTab({
                  id: selectedReceipt.id,
                  title: `${selectedReceipt.receiptNumber || selectedReceipt.id}: Kirim`,
                  type: "warehouse-receipt",
                  module: "warehouse",
                  documentData: selectedReceipt,
                });
              }}
              className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Kirimni ochish (F12)</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Glide Data Grid Body */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <DataEditor
            columns={columns}
            rows={matchedReceipts.length}
            getCellContent={getCellContent}
            onColumnResize={handleColumnResize}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellActivated={handleCellActivated}
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
          {selectedReceipt && (
            <ContextMenuItem
              onClick={() => {
                openTab({
                  id: selectedReceipt.id,
                  title: `${selectedReceipt.receiptNumber || selectedReceipt.id}: Kirim`,
                  type: "warehouse-receipt",
                  module: "warehouse",
                  documentData: selectedReceipt,
                });
              }}
              className="gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim hujjatini ochish ({selectedReceipt.receiptNumber || selectedReceipt.id})</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => {
              if (selectedReceipt) {
                navigator.clipboard.writeText(selectedReceipt.receiptNumber || selectedReceipt.id);
              }
            }}
            className="gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Kirim raqamini nusxalash</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
