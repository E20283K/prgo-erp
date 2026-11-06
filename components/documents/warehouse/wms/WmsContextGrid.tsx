"use client";

import React, { useMemo, useCallback, useState } from "react";
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
import { WmsMode, WmsRack, WmsBin, WmsBinItem, WmsZone } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, Search, RefreshCw } from "lucide-react";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WmsContextGridProps {
  mode: WmsMode;
  racks: WmsRack[];
  bins: WmsBin[];
  binItems: WmsBinItem[];
  zones: WmsZone[];
  selectedRack: WmsRack | null;
  selectedBin: WmsBin | null;
  onSelectRack: (rack: WmsRack | null) => void;
  onSelectBin: (bin: WmsBin | null) => void;
  onSelectBinItem: (item: WmsBinItem | null) => void;
  onOpenCreateRackModal: () => void;
  onOpenPutawayModal: () => void;
  onNavigateToRack: (rack: WmsRack) => void;
  onNavigateToBin: (bin: WmsBin) => void;
  onRefresh: () => void;
}

export function WmsContextGrid({
  mode,
  racks,
  bins,
  binItems,
  zones,
  selectedRack,
  selectedBin,
  onSelectRack,
  onSelectBin,
  onSelectBinItem,
  onOpenCreateRackModal,
  onOpenPutawayModal,
  onNavigateToRack,
  onNavigateToBin,
  onRefresh,
}: WmsContextGridProps) {
  const { theme } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [filterText, setFilterText] = useState("");

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Rejimga qarab filtr va qatorlar ma'lumotlari
  const filteredData = useMemo(() => {
    const q = filterText.toLowerCase();

    if (mode === "map") {
      // Stelajlar ro'yxati
      return racks
        .filter((r) => r.type !== "aisle" && r.type !== "floor_stack" && r.type !== "obstacle")
        .filter((r) => {
          if (!q) return true;
          return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
        });
    }

    if (mode === "rack" && selectedRack) {
      // Shu stelajning kataklari
      return bins
        .filter((b) => b.rackId === selectedRack.id)
        .filter((b) => {
          if (!q) return true;
          return b.code.toLowerCase().includes(q);
        });
    }

    if (mode === "bin" && selectedBin) {
      // Shu katakning mahsulotlari
      return binItems
        .filter((it) => it.binId === selectedBin.id)
        .filter((it) => {
          if (!q) return true;
          return it.sku.toLowerCase().includes(q) || it.name.toLowerCase().includes(q);
        });
    }

    // Default holat: barcha mahsulotlar yoki bo'sh
    return [];
  }, [mode, racks, bins, binItems, selectedRack, selectedBin, filterText]);

  // Ustunlar konfiguratsiyasi
  const columns = useMemo<GridColumn[]>(() => {
    if (mode === "map") {
      return [
        { id: "code", title: "Stelaj kodi", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Nomi", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "zone", title: "Zona", width: 140, icon: GridColumnIcon.HeaderLookup },
        { id: "type", title: "Turi", width: 120, icon: GridColumnIcon.HeaderString },
        { id: "levels", title: "Qavatlar", width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: "bays", title: "Kataklar", width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: "occupancy", title: "Bandlik %", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "maxWeight", title: "Maks. yuk (kg)", width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Holati", width: 95, icon: GridColumnIcon.HeaderSingleValue },
      ];
    }

    if (mode === "rack") {
      return [
        { id: "code", title: "Katak kodi", width: 190, icon: GridColumnIcon.HeaderReference },
        { id: "level", title: "Qavat", width: 75, icon: GridColumnIcon.HeaderNumber },
        { id: "bay", title: "Ustun", width: 75, icon: GridColumnIcon.HeaderNumber },
        { id: "span", title: "Kenglik", width: 85, icon: GridColumnIcon.HeaderString },
        { id: "itemsCount", title: "SKU soni", width: 95, icon: GridColumnIcon.HeaderNumber },
        { id: "weight", title: "Yuk (kg)", width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "occupancy", title: "Bandlik %", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Holati", width: 105, icon: GridColumnIcon.HeaderSingleValue },
      ];
    }

    // Katak ichidagi mahsulotlar
    return [
      { id: "sku", title: "SKU kodi", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Mahsulot nomi", width: 240, icon: GridColumnIcon.HeaderString },
      { id: "container", title: "Konteyner", width: 110, icon: GridColumnIcon.HeaderLookup },
      { id: "quantity", title: "Miqdor", width: 100, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "weight", title: "Vazni (kg)", width: 95, icon: GridColumnIcon.HeaderNumber },
      { id: "batch", title: "Partiya / WO", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 180, icon: GridColumnIcon.HeaderTextTemplate },
    ];
  }, [mode]);

  // Katak ma'lumotlarini taqdim etish (getCellContent)
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = filteredData[rowIndex];
      if (!row) {
        return { kind: GridCellKind.Text, allowOverlay: false, data: "", displayData: "" };
      }

      if (mode === "map") {
        const rack = row as WmsRack;
        const rackBins = bins.filter((b) => b.rackId === rack.id);
        const occupied = rackBins.filter((b) => b.status === "full" || b.status === "partial").length;
        const occPct = rackBins.length > 0 ? Math.round((occupied / rackBins.length) * 100) : 0;
        const zoneObj = zones.find((z) => z.id === rack.zoneId);

        switch (colIndex) {
          case 0:
            return { kind: GridCellKind.Text, allowOverlay: false, data: rack.code, displayData: rack.code };
          case 1:
            return { kind: GridCellKind.Text, allowOverlay: false, data: rack.name, displayData: rack.name };
          case 2:
            return {
              kind: GridCellKind.Text,
              allowOverlay: false,
              data: zoneObj?.name || "Zonasiz",
              displayData: zoneObj ? `${zoneObj.code} - ${zoneObj.name}` : "—",
            };
          case 3:
            return { kind: GridCellKind.Text, allowOverlay: false, data: rack.type, displayData: rack.type };
          case 4:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: rack.levelsCount,
              displayData: String(rack.levelsCount),
            };
          case 5:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: rack.baysCount,
              displayData: String(rack.baysCount),
            };
          case 6:
            return { kind: GridCellKind.Number, allowOverlay: false, data: occPct, displayData: `${occPct}%` };
          case 7:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: Number(rack.maxWeightKg) || 0,
              displayData: `${rack.maxWeightKg} kg`,
            };
          case 8:
            return {
              kind: GridCellKind.Text,
              allowOverlay: false,
              data: rack.status,
              displayData: rack.status === "active" ? "Faol" : "Bloklangan",
            };
          default:
            return { kind: GridCellKind.Text, allowOverlay: false, data: "", displayData: "" };
        }
      }

      if (mode === "rack") {
        const bin = row as WmsBin;
        const items = binItems.filter((it) => it.binId === bin.id);

        switch (colIndex) {
          case 0:
            return { kind: GridCellKind.Text, allowOverlay: false, data: bin.code, displayData: bin.code };
          case 1:
            return { kind: GridCellKind.Number, allowOverlay: false, data: bin.level, displayData: `L${bin.level}` };
          case 2:
            return { kind: GridCellKind.Number, allowOverlay: false, data: bin.bay, displayData: `B${bin.bay}` };
          case 3:
            return {
              kind: GridCellKind.Text,
              allowOverlay: false,
              data: bin.colSpan > 1 ? "2x Keng" : "1x Standart",
              displayData: bin.colSpan > 1 ? "2x Keng" : "1x Standart",
            };
          case 4:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: items.length,
              displayData: String(items.length),
            };
          case 5:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: Number(bin.currentWeightKg) || 0,
              displayData: `${bin.currentWeightKg || 0} / ${bin.maxWeightKg} kg`,
            };
          case 6:
            return {
              kind: GridCellKind.Number,
              allowOverlay: false,
              data: bin.occupancyPct,
              displayData: `${bin.occupancyPct}%`,
            };
          case 7:
            return {
              kind: GridCellKind.Text,
              allowOverlay: false,
              data: bin.status,
              displayData:
                bin.status === "full"
                  ? "To'la"
                  : bin.status === "partial"
                  ? "Qisman"
                  : bin.status === "blocked"
                  ? "Birlashtirilgan"
                  : "Bo'sh",
            };
          default:
            return { kind: GridCellKind.Text, allowOverlay: false, data: "", displayData: "" };
        }
      }

      // Mode === "bin"
      const item = row as WmsBinItem;
      switch (colIndex) {
        case 0:
          return { kind: GridCellKind.Text, allowOverlay: false, data: item.sku, displayData: item.sku };
        case 1:
          return { kind: GridCellKind.Text, allowOverlay: false, data: item.name, displayData: item.name };
        case 2:
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            data: item.containerType,
            displayData: item.containerType.toUpperCase(),
          };
        case 3:
          return {
            kind: GridCellKind.Number,
            allowOverlay: false,
            data: Number(item.quantity) || 0,
            displayData: String(item.quantity),
          };
        case 4:
          return { kind: GridCellKind.Text, allowOverlay: false, data: item.unit, displayData: item.unit };
        case 5:
          return {
            kind: GridCellKind.Number,
            allowOverlay: false,
            data: Number(item.weightKg) || 0,
            displayData: `${item.weightKg} kg`,
          };
        case 6:
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            data: item.batchNumber || "",
            displayData: item.batchNumber || item.workOrderId || "—",
          };
        case 7:
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            data: item.notes || "",
            displayData: item.notes || "—",
          };
        default:
          return { kind: GridCellKind.Text, allowOverlay: false, data: "", displayData: "" };
      }
    },
    [filteredData, mode, bins, binItems, zones]
  );

  // Qatorda tanlash (1 click) va Ochish (2 click)
  const handleCellActivated = (cell: Item) => {
    const [, rowIndex] = cell;
    const row = filteredData[rowIndex];
    if (!row) return;

    if (mode === "map") {
      onNavigateToRack(row as WmsRack);
    } else if (mode === "rack") {
      onNavigateToBin(row as WmsBin);
    }
  };

  const handleGridSelectionChange = (newSelection: GridSelection) => {
    setSelection(newSelection);
    const selectedRows = newSelection.rows.toArray();
    if (selectedRows.length > 0) {
      const row = filteredData[selectedRows[0]];
      if (row) {
        if (mode === "map") onSelectRack(row as WmsRack);
        else if (mode === "rack") onSelectBin(row as WmsBin);
        else if (mode === "bin") onSelectBinItem(row as WmsBinItem);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-card border-t border-border">
      {/* Grid Toolbar */}
      <div className="flex items-center justify-between p-2 px-3 border-b border-border bg-muted/20 gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="size-3.5 absolute left-2 top-2 text-muted-foreground" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Jadvaldan qidirish..."
              className="h-7 pl-7 text-xs bg-background"
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
            {filteredData.length} ta yozuv
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {mode === "map" && (
            <Button size="sm" onClick={onOpenCreateRackModal} className="h-7 text-xs gap-1">
              <Plus className="size-3.5" />
              <span>Stelaj qo'shish</span>
            </Button>
          )}

          {mode === "bin" && (
            <Button size="sm" onClick={onOpenPutawayModal} className="h-7 text-xs gap-1">
              <Plus className="size-3.5" />
              <span>Mahsulot joylash</span>
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={onRefresh} className="h-7 px-2">
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Glide Data Grid Canvas */}
      <div className="flex-1 w-full min-h-0 relative">
        <DataEditor
          columns={columns}
          rows={filteredData.length}
          getCellContent={getCellContent}
          onCellActivated={handleCellActivated}
          gridSelection={selection}
          onGridSelectionChange={handleGridSelectionChange}
          theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          rowMarkers="both"
          smoothScrollX
          smoothScrollY
          height="100%"
          width="100%"
        />
      </div>
    </div>
  );
}
