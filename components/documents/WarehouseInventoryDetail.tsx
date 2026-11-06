"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  ClipboardList,
  Save,
  Check,
  Lock,
  Sparkles,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export interface InventoryLineItem {
  id: string;
  sku: string;
  name: string;
  category?: string;
  sheetFormat?: string;
  unit: string;
  systemQty: number;
  actualQty: number;
  variance: number;
  unitPriceUsd: number;
  varianceCostUsd: number;
  notes?: string;
}

export interface InventoryCountDoc {
  id: string;
  date: string;
  warehouse: string;
  categoryFilter: string;
  countedBy: string;
  notes: string;
  status: "Completed" | "Draft";
  items: InventoryLineItem[];
}

export const CATEGORY_FILTER_LABELS: Record<string, string> = {
  ALL: "Barcha materiallar",
  "Paper & Board": "Qog'oz va karton",
  "Roll & Label": "Rulon va etiketka",
  "Inks & Plates": "Bo'yoq va plastina",
  Offcuts: "Delovoy otxodlar",
};

export function WarehouseInventoryDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    warehousesList,
    loadWarehouses,
    employees,
    upsertWarehouseStock,
    upsertInventoryCountAsync,
    replaceTabId,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const initialDoc = useMemo<InventoryCountDoc>(() => {
    const d = tab.documentData || {};
    let initialItems: InventoryLineItem[] = [];

    if (Array.isArray(d.items) && d.items.length > 0) {
      initialItems = d.items.map((i: any) => {
        const sys = Number(i.systemQty) || 0;
        const act = Number(i.actualQty) !== undefined && i.actualQty !== "" ? Number(i.actualQty) : sys;
        const vari = act - sys;
        const price = Number(i.unitPriceUsd) || 0.15;
        return {
          id: i.id || `item-${Date.now()}-${Math.random()}`,
          sku: i.sku || i.materialSku || "",
          name: i.name || i.materialName || i.material || "Material",
          category: i.category || "Paper & Board",
          sheetFormat: i.sheetFormat || "",
          unit: i.unit || "sheets",
          systemQty: sys,
          actualQty: act,
          variance: vari,
          unitPriceUsd: price,
          varianceCostUsd: Number((vari * price).toFixed(2)),
          notes: i.notes || "",
        };
      });
    } else if (d.material || d.materialName) {
      const sys = Number(d.systemQty) || 0;
      const act = Number(d.actualQty) || sys;
      const vari = act - sys;
      initialItems = [
        {
          id: `item-${Date.now()}`,
          sku: d.materialSku || `MAT-${Date.now().toString().slice(-4)}`,
          name: d.material || d.materialName || "Material",
          category: "Paper & Board",
          sheetFormat: "",
          unit: d.unit || "sheets",
          systemQty: sys,
          actualQty: act,
          variance: vari,
          unitPriceUsd: 0.15,
          varianceCostUsd: Number((vari * 0.15).toFixed(2)),
          notes: d.notes || "",
        },
      ];
    }

    return {
      id: d.id || tab.id,
      date: d.date || d.countDate || new Date().toISOString().split("T")[0],
      warehouse: d.warehouse || d.location || d.locationName || (warehousesList[0]?.name || "Asosiy ombor"),
      categoryFilter: d.categoryFilter || "ALL",
      countedBy: d.countedBy || (employees[0]?.fullName || "Ombor mudiri"),
      notes: d.notes || "",
      status: d.status === "Completed" ? "Completed" : "Draft",
      items: initialItems,
    };
  }, [tab.documentData, tab.id, warehousesList, employees]);

  const [doc, setDoc] = useState<InventoryCountDoc>(initialDoc);
  const isLocked = doc.status === "Completed";
  const isDraft =
    !doc.id ||
    doc.id.startsWith("draft-") ||
    doc.id.startsWith("new-") ||
    doc.id.startsWith("IC-NEW-") ||
    doc.id.startsWith("tab-");

  useEffect(() => {
    if (warehousesList.length === 0 && loadWarehouses) {
      loadWarehouses("PRINTGOO");
    }
  }, [warehousesList.length, loadWarehouses]);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const selectedRows = selection.rows.toArray();
  const hasSelectedRow = selectedRows.length > 0;

  const handleFieldChange = useCallback(
    (field: keyof InventoryCountDoc, val: any) => {
      if (isLocked) return;
      setDoc((prev) => ({ ...prev, [field]: val }));
      setTabUnsaved(tab.id, true);
    },
    [isLocked, setTabUnsaved, tab.id]
  );

  // 1C Uslubidagi "Ombor qoldig'i bo'yicha to'ldirish" (Fill by stock)
  const handleFillFromStock = () => {
    if (isLocked) return;

    let targetStock = warehouseStock;
    if (doc.warehouse) {
      targetStock = targetStock.filter((s) => s.location === doc.warehouse);
    }
    if (doc.categoryFilter !== "ALL") {
      if (doc.categoryFilter === "Offcuts") {
        targetStock = targetStock.filter((s) => s.isOffcut);
      } else {
        targetStock = targetStock.filter((s) => s.category === doc.categoryFilter);
      }
    }

    if (targetStock.length === 0) {
      alert("Tanlangan parametrlar bo'yicha omborda xomashyo topilmadi!");
      return;
    }

    const items: InventoryLineItem[] = targetStock.map((s, idx) => {
      const sys = Number(s.stockLevel) || 0;
      const price = Number(s.unitPriceUsd) || 0.15;
      return {
        id: `ic-item-${Date.now()}-${idx}`,
        sku: s.sku,
        name: s.name,
        category: s.category,
        sheetFormat: s.sheetFormat || "",
        unit: s.unit || "sheets",
        systemQty: sys,
        actualQty: sys, // Boshlang'ichda haqiqiy qoldiq = dastur qoldig'i
        variance: 0,
        unitPriceUsd: price,
        varianceCostUsd: 0,
        notes: "",
      };
    });

    setDoc((prev) => ({ ...prev, items }));
    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Jadval qoldiqlar bilan to'ldirildi",
      description: `${items.length} ta xomashyo muvaffaqiyatli yuklandi. Endi haqiqiy qoldiqni kiriting.`,
      severity: "info",
    });
  };

  // Inline katak tahrirlash (faqat ActualQty)
  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (isLocked) return;
      const [col, row] = cell;
      if (col !== 6) return; // Column 6: Actual Qty

      const newActual = Number(newValue.data) || 0;

      setDoc((prev) => {
        const next = [...prev.items];
        const target = next[row];
        if (!target) return prev;

        const vari = newActual - target.systemQty;
        const cost = Number((vari * target.unitPriceUsd).toFixed(2));

        next[row] = {
          ...target,
          actualQty: newActual,
          variance: vari,
          varianceCostUsd: cost,
        };

        return { ...prev, items: next };
      });
      setTabUnsaved(tab.id, true);
    },
    [isLocked, setTabUnsaved, tab.id]
  );

  const handleDeleteSelected = () => {
    if (isLocked || selectedRows.length === 0) return;
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

  const handleSaveDraft = async () => {
    const realId = isDraft ? `IC-${Date.now().toString().slice(-4)}` : doc.id;
    const payload = {
      ...doc,
      id: realId,
      countNumber: realId,
      location: doc.warehouse,
      status: "Draft",
      items: doc.items,
    };

    await upsertInventoryCountAsync(payload);
    if (isDraft) {
      setDoc((prev) => ({ ...prev, id: realId }));
      replaceTabId(tab.id, realId, `${realId}: Inventarizatsiya`, { ...doc, id: realId });
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Inventarizatsiya saqlandi",
      description: `${realId} qoralamasi muvaffaqiyatli saqlandi.`,
      severity: "info",
    });
  };

  // 1C Uslubidagi "Tasdiqlash va balansni tenglashtirish"
  const handlePostDocument = async () => {
    if (isLocked) return;
    if (!doc.warehouse?.trim()) {
      alert("Omborni tanlash shart!");
      return;
    }
    if (doc.items.length === 0) {
      alert("Inventarizatsiya jadvalida kamida bitta material bo'lishi shart!");
      return;
    }

    const realId = isDraft ? `IC-${Date.now().toString().slice(-4)}` : doc.id;

    // Ombor qoldiqlarini haqiqiy sanalgan qoldiqqa tenglashtirish
    doc.items.forEach((item) => {
      const target = warehouseStock.find(
        (s) => (s.sku === item.sku || s.name === item.name) && s.location === doc.warehouse
      );
      if (target) {
        upsertWarehouseStock({
          ...target,
          stockLevel: item.actualQty,
          available: Math.max(0, item.actualQty - target.reserved),
        });
      }
    });

    const payload = {
      ...doc,
      id: realId,
      countNumber: realId,
      location: doc.warehouse,
      status: "Completed",
      items: doc.items,
    };

    await upsertInventoryCountAsync(payload);
    setDoc((prev) => ({ ...prev, id: realId, status: "Completed" }));
    if (isDraft) {
      replaceTabId(tab.id, realId, `${realId}: Sanaldi`, {
        ...doc,
        id: realId,
        status: "Completed",
      });
    }
    setTabUnsaved(tab.id, false);

    const surplusCount = doc.items.filter((i) => i.variance > 0).length;
    const shortageCount = doc.items.filter((i) => i.variance < 0).length;

    addNotification({
      title: `Inventarizatsiya tasdiqlandi: ${realId}`,
      description: `Ombor qoldiqlari haqiqiy hisobga tenglashtirildi (${surplusCount} ta ortiqcha, ${shortageCount} ta kamomad).`,
      severity: "success",
    });

    closeTab(realId);
    closeTab(tab.id);
  };

  const columns = useMemo<GridColumn[]>(() => {
    return [
      { id: "index", title: "№", width: 45, icon: GridColumnIcon.HeaderRowID },
      { id: "sku", title: "SKU Kodi", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Material Nomi", width: 280, icon: GridColumnIcon.HeaderString },
      { id: "sheetFormat", title: "Format", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "systemQty", title: "Dasturda (System)", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "actualQty", title: "Haqiqiy (Fakt)", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "variance", title: "Farq (Farq soni)", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "varianceCostUsd", title: "Farq summasi ($)", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "notes", title: "Izoh", width: 200, icon: GridColumnIcon.HeaderTextTemplate },
    ];
  }, []);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = doc.items[row];
      if (!item) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

      const colId = columns[col]?.id;

      if (colId === "index") {
        return {
          kind: GridCellKind.Number,
          data: row + 1,
          displayData: String(row + 1),
          allowOverlay: false,
          contentAlign: "center",
        };
      }
      if (colId === "sku") {
        return {
          kind: GridCellKind.Text,
          data: item.sku || "",
          displayData: item.sku || "",
          allowOverlay: false,
        };
      }
      if (colId === "name") {
        return {
          kind: GridCellKind.Text,
          data: item.name || "",
          displayData: item.name || "",
          allowOverlay: false,
        };
      }
      if (colId === "sheetFormat") {
        return {
          kind: GridCellKind.Text,
          data: item.sheetFormat || "",
          displayData: item.sheetFormat || "",
          allowOverlay: false,
        };
      }
      if (colId === "unit") {
        return {
          kind: GridCellKind.Text,
          data: item.unit || "sheets",
          displayData: item.unit || "sheets",
          allowOverlay: false,
        };
      }
      if (colId === "systemQty") {
        const val = Number(item.systemQty) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#a1a1aa" : "#71717a",
          },
        };
      }
      if (colId === "actualQty") {
        const val = Number(item.actualQty) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px monospace",
          },
        };
      }
      if (colId === "variance") {
        const val = Number(item.variance) || 0;
        const color =
          val > 0
            ? isDark ? "#4ade80" : "#16a34a"
            : val < 0
            ? isDark ? "#f87171" : "#dc2626"
            : isDark ? "#a1a1aa" : "#71717a";

        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString(),
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 12px monospace",
          },
        };
      }
      if (colId === "varianceCostUsd") {
        const val = Number(item.varianceCostUsd) || 0;
        const color =
          val > 0
            ? isDark ? "#4ade80" : "#16a34a"
            : val < 0
            ? isDark ? "#f87171" : "#dc2626"
            : isDark ? "#a1a1aa" : "#71717a";

        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val > 0 ? `+$${val.toFixed(2)}` : `$${val.toFixed(2)}`,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 12px monospace",
          },
        };
      }
      if (colId === "notes") {
        return {
          kind: GridCellKind.Text,
          data: item.notes || "",
          displayData: item.notes || "",
          allowOverlay: !isLocked,
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [doc.items, columns, isLocked, isDark]
  );

  const totalVarianceCost = useMemo(() => {
    return doc.items.reduce((acc, i) => acc + (Number(i.varianceCostUsd) || 0), 0);
  }, [doc.items]);

  const surplusCount = useMemo(() => doc.items.filter((i) => i.variance > 0).length, [doc.items]);
  const shortageCount = useMemo(() => doc.items.filter((i) => i.variance < 0).length, [doc.items]);
  const matchedCount = useMemo(() => doc.items.filter((i) => i.variance === 0).length, [doc.items]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1. Header Toolbar */}
      <div className="px-3 py-2 bg-card border-b border-border flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ClipboardList className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {isDraft ? "Yangi: Inventarizatsiya hujjati" : `${doc.id}: Inventarizatsiya dalolatnomasi`}
              </span>
              {isLocked ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
                  <Lock className="size-3" />
                  <span>Sanalgan va tenglashtirilgan</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
                  Qoralama
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!isLocked && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFillFromStock}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
              >
                <Sparkles className="size-3" />
                <span>Qoldiq bo'yicha to'ldirish</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Saqlash</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePostDocument}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Tasdiqlash va balansni tenglashtirish</span>
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => closeTab(tab.id)}
            className="h-7 px-2.5 text-xs cursor-pointer"
          >
            Yopish
          </Button>
        </div>
      </div>

      {/* 2. Requisites Grid */}
      <div className="p-3 bg-card border-b border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Hujjat № va sana</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={isDraft ? "Yangi" : doc.id}
              readOnly
              className="h-7 text-xs font-mono bg-muted/40 w-24 text-muted-foreground font-medium"
            />
            <DatePicker
              value={doc.date}
              disabled={isLocked}
              onChange={(val) => handleFieldChange("date", val)}
              className="h-7 text-xs font-mono bg-background flex-1"
            />
          </div>
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Sanayotgan ombor *</Label>
          <WarehouseSelect
            value={doc.warehouse}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("warehouse", val.warehouseName)}
            placeholder="Omborni tanlang..."
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Material toifasi</Label>
          <Select
            value={doc.categoryFilter}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("categoryFilter", val)}
          >
            <SelectTrigger className="h-7 w-full text-xs bg-background">
              <SelectValue>
                {CATEGORY_FILTER_LABELS[doc.categoryFilter] || doc.categoryFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">Barcha materiallar</SelectItem>
              <SelectItem value="Paper & Board" className="text-xs">Qog'oz va karton</SelectItem>
              <SelectItem value="Roll & Label" className="text-xs">Rulon va etiketka</SelectItem>
              <SelectItem value="Inks & Plates" className="text-xs">Bo'yoq va plastina</SelectItem>
              <SelectItem value="Offcuts" className="text-xs">Delovoy otxodlar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Komissiya a'zosi / Tekshiruvchi</Label>
          <Input
            value={doc.countedBy}
            disabled={isLocked}
            onChange={(e) => handleFieldChange("countedBy", e.target.value)}
            placeholder="Xodim ismi..."
            className="h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* 3. Items Toolbar */}
      <div className="px-3 bg-muted/40 border-b border-border flex items-center justify-between h-9 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">
            Sanalgan materiallar ro'yxati
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
            {doc.items.length} ta pozitsiya
          </Badge>

          {!isLocked && hasSelectedRow && (
            <>
              <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteSelected}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1 cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>Qatorni o'chirish</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-muted-foreground">Mos: <b className="text-foreground">{matchedCount}</b></span>
          <span className="text-emerald-600 dark:text-emerald-400">Ortiqcha: <b>+{surplusCount}</b></span>
          <span className="text-rose-600 dark:text-rose-400">Kamomad: <b>-{shortageCount}</b></span>
          <Separator orientation="vertical" className="h-3.5" />
          <span className="text-muted-foreground">Balans farqi: <b className={totalVarianceCost >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>${totalVarianceCost.toFixed(2)} USD</b></span>
        </div>
      </div>

      {/* 4. Tabular Data Editor with Inline Editing */}
      <div className="flex-1 w-full min-h-0 relative">
        <DataEditor
          width="100%"
          height="100%"
          columns={columns}
          rows={doc.items.length}
          getCellContent={getContent}
          onCellEdited={handleCellEdited}
          gridSelection={selection}
          onGridSelectionChange={setSelection}
          rowMarkers="number"
          smoothScrollX={true}
          smoothScrollY={true}
          theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
        />
      </div>
    </div>
  );
}
