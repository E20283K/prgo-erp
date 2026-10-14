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
  EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  WarehouseStockRecord,
} from "@/store/workspaceStore";
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
  ArrowDownToLine,
  Plus,
  Trash2,
  Printer,
  Save,
  Check,
  Lock,
  Boxes,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export interface ReceiptLineItem {
  id: string;
  sku: string;
  name: string;
  category: WarehouseStockRecord["category"];
  sheetFormat: string;
  grammage: number;
  quantity: number;
  unit: WarehouseStockRecord["unit"];
  unitPriceUsd: number;
}

export interface WarehouseReceiptDoc {
  id: string;
  date: string;
  supplier: string;
  poNumber: string;
  location: string;
  receivedBy: string;
  status: "Draft" | "Accepted";
  notes: string;
  items: ReceiptLineItem[];
}

export function WarehouseReceiptDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    upsertWarehouseStock,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const initialDoc = useMemo<WarehouseReceiptDoc>(() => {
    const d = tab.documentData || {};
    const defaultMaterialName = d.material || "Bohemia Gloss Coated 300g/m² (700×1000 B1)";
    const matchedStock = warehouseStock.find(
      (s) =>
        s.name.toLowerCase().includes(defaultMaterialName.toLowerCase()) ||
        defaultMaterialName.toLowerCase().includes(s.name.toLowerCase())
    );
    return {
      id: d.id || tab.id,
      date: d.date || new Date().toISOString().split("T")[0],
      supplier: d.supplier || "Tashkent Paper Trade LLC",
      poNumber: d.poNumber || `PO-2026-${Math.floor(100 + Math.random() * 899)}`,
      location: d.location || "Main Factory — Tashkent (Rack A-01)",
      receivedBy: d.receivedBy || "D. Karimov (Ombor mudiri)",
      status: d.status === "Accepted" || d.status === "Received" || d.status === "Completed" ? "Accepted" : "Draft",
      notes: d.notes || "",
      items: d.items || [
        {
          id: "line-1",
          sku: matchedStock?.sku || "PAP-300-B1",
          name: defaultMaterialName,
          category: matchedStock?.category || "Paper & Board",
          sheetFormat: matchedStock?.sheetFormat || "700×1000",
          grammage: matchedStock?.grammage || 300,
          quantity: Number(d.quantity) || 5000,
          unit: matchedStock?.unit || (d.unit as any) || "sheets",
          unitPriceUsd: matchedStock?.unitPriceUsd || 0.24,
        },
      ],
    };
  }, [tab.documentData, tab.id, warehouseStock]);

  const [doc, setDoc] = useState<WarehouseReceiptDoc>(initialDoc);
  const isPosted = doc.status === "Accepted";

  const totalAmountUsd = useMemo(
    () =>
      Number(
        doc.items
          .reduce((acc, item) => acc + item.quantity * item.unitPriceUsd, 0)
          .toFixed(2)
      ),
    [doc.items]
  );

  const totalQty = useMemo(
    () => doc.items.reduce((acc, item) => acc + item.quantity, 0),
    [doc.items]
  );

  const handleFieldChange = (field: keyof WarehouseReceiptDoc, val: any) => {
    if (isPosted) return;
    setDoc((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: "SKU / Kod", width: 115, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Material / Xomashyo Nomi", width: 310, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Toifa (Category)", width: 155, icon: GridColumnIcon.HeaderSingleValue },
      { id: "sheetFormat", title: "Format", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "grammage", title: "Zichlik (g/m²)", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "quantity", title: "Kirim Miqdori (Qty)", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 85, icon: GridColumnIcon.HeaderString },
      { id: "unitPriceUsd", title: "Birlik Narxi ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "lineTotal", title: "Jami Summa ($)", width: 140, icon: GridColumnIcon.HeaderNumber },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = doc.items[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "lineTotal") {
        const total = Number((item.quantity * item.unitPriceUsd).toFixed(2));
        return {
          kind: GridCellKind.Number,
          data: total,
          displayData: `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "700 12px monospace",
            textDark: isDark ? "#4ade80" : "#15803d",
          },
        };
      }

      if (column.id === "quantity" || column.id === "unitPriceUsd" || column.id === "grammage") {
        const num = Number((item as any)[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData:
            column.id === "unitPriceUsd"
              ? `$${num.toFixed(3)}`
              : num.toLocaleString(),
          allowOverlay: !isPosted,
          readonly: isPosted,
          contentAlign: "right",
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal,
        allowOverlay: !isPosted,
        readonly: isPosted,
      };
    },
    [doc.items, columns, isPosted, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (isPosted) return;
      const [col, row] = cell;
      const column = columns[col];
      if (!column) return;

      setDoc((prev) => {
        const nextItems = [...prev.items];
        const target = { ...nextItems[row] };
        if (!target) return prev;

        if (
          (column.id === "quantity" ||
            column.id === "unitPriceUsd" ||
            column.id === "grammage") &&
          newValue.kind === GridCellKind.Number
        ) {
          (target as any)[column.id] = Number(newValue.data) || 0;
        } else if (newValue.kind === GridCellKind.Text && column.id) {
          (target as any)[column.id] = newValue.data;
        }

        nextItems[row] = target;
        return { ...prev, items: nextItems };
      });
      setTabUnsaved(tab.id, true);
    },
    [isPosted, columns, setTabUnsaved, tab.id]
  );

  const handleAddLineFromCatalog = (stockItem?: WarehouseStockRecord) => {
    if (isPosted) return;
    const base = stockItem || warehouseStock[0];
    const newLine: ReceiptLineItem = {
      id: `line-${Date.now()}`,
      sku: base?.sku || `PAP-${100 + doc.items.length}`,
      name: base?.name || "Melovannaya Qog'oz 250g/m² (700×1000)",
      category: base?.category || "Paper & Board",
      sheetFormat: base?.sheetFormat || "700×1000",
      grammage: base?.grammage || 250,
      quantity: 3000,
      unit: base?.unit || "sheets",
      unitPriceUsd: base?.unitPriceUsd || 0.19,
    };
    setDoc((prev) => ({ ...prev, items: [...prev.items, newLine] }));
    setTabUnsaved(tab.id, true);
  };

  const handleDeleteSelected = () => {
    if (isPosted) return;
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0 || doc.items.length <= 1) return;
    setDoc((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => !selectedRows.includes(idx)),
    }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  const handlePostReceipt = () => {
    if (isPosted) return;
    doc.items.forEach((line) => {
      const existing = warehouseStock.find(
        (s) =>
          s.sku.toLowerCase() === line.sku.toLowerCase() ||
          s.name.toLowerCase() === line.name.toLowerCase()
      );
      if (existing) {
        upsertWarehouseStock({
          ...existing,
          stockLevel: existing.stockLevel + line.quantity,
          unitPriceUsd: line.unitPriceUsd || existing.unitPriceUsd,
          lastReceived: doc.date,
        });
      } else {
        upsertWarehouseStock({
          sku: line.sku,
          name: line.name,
          category: line.category,
          grammage: line.grammage,
          sheetFormat: line.sheetFormat,
          unit: line.unit,
          location: doc.location,
          stockLevel: line.quantity,
          reserved: 0,
          available: line.quantity,
          reorder: 2000,
          unitPriceUsd: line.unitPriceUsd,
          lastReceived: doc.date,
          status: "In Stock",
        });
      }
    });

    setDoc((prev) => ({ ...prev, status: "Accepted" }));
    setTabUnsaved(tab.id, false);
    addNotification({
      title: `Ombor kirimi tasdiqlandi: ${doc.id}`,
      description: `${doc.items.length} turdagi xomashyo (${totalQty.toLocaleString()} birlik, $${totalAmountUsd.toLocaleString()}) ombor qoldig'iga qo'shildi.`,
      severity: "success",
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Top Document Action Bar */}
      <div className="px-3 bg-muted/60 border-b border-border shrink-0 flex items-center justify-between h-9 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowDownToLine className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-xs truncate">
            Ombor Kirim Hujjati (Приходная накладная): {doc.id}
          </span>
          <Separator orientation="vertical" className="h-4 mx-1" />
          {isPosted ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px] gap-1">
              <Lock className="w-3 h-3" />
              <span>Tasdiqlangan (Оприходовано)</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px]">
              Qoralama (Draft)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => typeof window !== "undefined" && window.print()}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Chop etish</span>
          </Button>
          {!isPosted && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTabUnsaved(tab.id, false)}
                className="h-7 px-2.5 text-xs gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Saqlash</span>
              </Button>
              <Button
                size="sm"
                onClick={handlePostReceipt}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Omborga kirim qilish (Провести)</span>
              </Button>
            </>
          )}
          {isPosted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => closeTab(tab.id)}
              className="h-7 px-3 text-xs"
            >
              Yopish
            </Button>
          )}
        </div>
      </div>

      {/* Document Header Requisites */}
      <div className="p-3 bg-card border-b border-border grid grid-cols-1 md:grid-cols-5 gap-3 shrink-0">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Hujjat № va Sana</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={doc.id}
              readOnly
              className="h-7 text-xs font-mono bg-muted/50 w-28"
            />
            <Input
              type="date"
              value={doc.date}
              readOnly={isPosted}
              onChange={(e) => handleFieldChange("date", e.target.value)}
              className="h-7 text-xs font-mono bg-background flex-1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Yetkazib beruvchi (Postavshik)</Label>
          <Input
            value={doc.supplier}
            readOnly={isPosted}
            onChange={(e) => handleFieldChange("supplier", e.target.value)}
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Shartnoma / Invoice № (PO)</Label>
          <Input
            value={doc.poNumber}
            readOnly={isPosted}
            onChange={(e) => handleFieldChange("poNumber", e.target.value)}
            className="h-7 text-xs font-mono bg-background"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Qabul qiluvchi Ombor</Label>
          <Input
            value={doc.location}
            readOnly={isPosted}
            onChange={(e) => handleFieldChange("location", e.target.value)}
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Qabul qildi (Ombor mudiri)</Label>
          <Input
            value={doc.receivedBy}
            readOnly={isPosted}
            onChange={(e) => handleFieldChange("receivedBy", e.target.value)}
            className="h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* Tabular Section Toolbar (Табличная часть) */}
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Boxes className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-xs">
            Kirim qilinayotgan materiallar ro&apos;yxati (Табличная часть)
          </span>
          {!isPosted && (
            <>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddLineFromCatalog()}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>+ Qator qo&apos;shish</span>
              </Button>
              <Select
                onValueChange={(sku) => {
                  const found = warehouseStock.find((s) => s.sku === sku);
                  if (found) handleAddLineFromCatalog(found);
                }}
              >
                <SelectTrigger className="h-7 w-60 text-xs bg-background">
                  <SelectValue placeholder="Ombor katalogidan tanlab qo'shish..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouseStock.map((s) => (
                    <SelectItem key={s.sku} value={s.sku}>
                      {s.sku} — {s.name} ({s.available.toLocaleString()} {s.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteSelected}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O&apos;chirish</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <span>
            Qatorlar: <strong>{doc.items.length}</strong>
          </span>
          <span>
            Jami Miqdor: <strong>{totalQty.toLocaleString()}</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Jami Summa: ${totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Full-Screen Glide Data Grid for Receipt Line Items */}
      <div className="flex-1 w-full h-full relative">
        <DataEditor
          getCellContent={getCellContent}
          onCellEdited={handleCellEdited}
          columns={columns}
          rows={doc.items.length}
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
  );
}
