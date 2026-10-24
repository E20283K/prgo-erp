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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { PositionRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Plus, Search, RefreshCw, CheckCircle2, Printer } from "lucide-react";

export function PositionsGrid() {
  const { theme, openTab, positionsList, upsertPosition, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Form states
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("Flekso bosma sexi");
  const [newWageType, setNewWageType] = useState<any>("piecework");
  const [newRate, setNewRate] = useState("4500000");

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/positions"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(positionsList);
      }
    } catch {
      setData(positionsList);
    } finally {
      setLoading(false);
    }
  }, [positionsList]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const s = searchFilter.toLowerCase();
      return p.title.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
    });
  }, [data, searchFilter]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "code", title: "Lavozim kodi", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "title", title: "Lavozim nomi (Shtat birligi)", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "departmentName", title: "Tegishli sex / bo'lim", width: 200, icon: GridColumnIcon.HeaderString },
      { id: "defaultWageType", title: "Stavka shakli", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "standardRate", title: "Standart tarif / oklad", width: 160, icon: GridColumnIcon.HeaderNumber },
      { id: "employeesCount", title: "Band shtatlar", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "isActive", title: "Holati", width: 100, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      const row = filtered[rowIndex];

      if (!col || !col.id || !row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (col.id === "code") {
        return {
          kind: GridCellKind.Text,
          data: row.code,
          displayData: row.code,
          allowOverlay: true,
          themeOverride: { textDark: "#2563eb", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "standardRate") {
        const rate = Number(row.standardRate) || 0;
        return {
          kind: GridCellKind.Text,
          data: String(rate),
          displayData: `${rate.toLocaleString("uz-UZ")} UZS`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "isActive") {
        const active = row.isActive !== false;
        return {
          kind: GridCellKind.Text,
          data: active ? "Active" : "Inactive",
          displayData: active ? "Faol" : "Nofaol",
          allowOverlay: false,
          themeOverride: {
            textDark: active ? "#059669" : "#dc2626",
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      const rawVal = (row as any)[col.id] ?? "";
      return {
        kind: GridCellKind.Text,
        data: String(rawVal),
        displayData: String(rawVal),
        allowOverlay: true,
      };
    },
    [columns, filtered]
  );

  const handleOpenDetail = useCallback(
    (pos: PositionRecord) => {
      openTab({
        id: `pos-${pos.id}`,
        title: `${pos.title} (${pos.code})`,
        type: "position-detail",
        module: "hr",
        documentData: pos,
      });
    },
    [openTab]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const pos = filtered[rowIndex];
      if (pos) handleOpenDetail(pos);
    },
    [filtered, handleOpenDetail]
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    const payload: Partial<PositionRecord> = {
      code: newCode.trim() || `POS-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      departmentName: newDepartment,
      defaultWageType: newWageType,
      standardRate: Number(newRate) || 0,
      currency: "UZS",
      isActive: true,
    };

    try {
      const res = await fetch("/api/v1/hr/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        payload.id = json.id;
        upsertPosition(payload as PositionRecord);
        addNotification({
          title: "Lavozim kiritildi",
          description: `${payload.title} shtat birligi saqlandi.`,
          severity: "success",
        });
        setIsAddOpen(false);
        fetchPositions();
        handleOpenDetail(payload as PositionRecord);
      }
    } catch {
      payload.id = `pos-${Date.now()}`;
      upsertPosition(payload as PositionRecord);
      setIsAddOpen(false);
      handleOpenDetail(payload as PositionRecord);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* ── 1C Enterprise Industrial Toolbar ── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi lavozim</span>
          </Button>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Lavozim yoki kodi..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchPositions}
            disabled={loading}
            title="Ro'yxatni yangilash"
            aria-label="Ro'yxatni yangilash"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => window.print()}
            title="Chop etish"
          >
            <Printer className="size-3.5" />
            <span className="hidden sm:inline">Chop etish</span>
          </Button>

          <Badge variant="outline" className="font-mono text-[11px] h-6 px-1.5 font-normal">
            {filtered.length}
          </Badge>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden">
        <div className="absolute inset-0">
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={filtered.length}
            getCellContent={getCellContent}
            rowMarkers="both"
            freezeColumns={1}
            headerHeight={28}
            rowHeight={27}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellActivated={handleCellActivated}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            smoothScrollX
            smoothScrollY
          />
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              Yangi Lavozim Qo'shish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Shtat jadvaliga yangi kasbiy lavozim va tarif stavkasi kiritiladi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Lavozim kodi *</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="masalan: POS-FLEXO-M"
                className="h-8 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Lavozim nomi *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="masalan: Katta flekso pechatnik"
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sex / Bo'lim</Label>
                <Select value={newDepartment} onValueChange={(val) => { if (val) setNewDepartment(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flekso bosma sexi">Flekso bosma</SelectItem>
                    <SelectItem value="Tikuvchilik va lenta sexi">Tikuvchilik sexi</SelectItem>
                    <SelectItem value="Kesish va qadoqlash sexi">Kesish va qadoqlash</SelectItem>
                    <SelectItem value="Prepress va dizayn">Prepress</SelectItem>
                    <SelectItem value="Sifat nazorati (OTK)">OTK nazorati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">To'lov shakli</Label>
                <Select value={newWageType} onValueChange={(val) => { if (val) setNewWageType(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piecework">Ishbay (Sdelka)</SelectItem>
                    <SelectItem value="salary">Oklad (Sobit)</SelectItem>
                    <SelectItem value="hourly">Soatbay</SelectItem>
                    <SelectItem value="mixed">Aralash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Standart stavka / oklad (UZS)</Label>
              <Input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="h-8 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground gap-1" onClick={handleCreate}>
              <CheckCircle2 className="size-3.5" />
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
