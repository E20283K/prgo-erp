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
import { ShiftRecord } from "../types";
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
import { Clock, Plus, Search, RefreshCw, CheckCircle2, Printer } from "lucide-react";

export function ShiftsGrid() {
  const { theme, openTab, shiftsList, upsertShift, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Form states
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("20:00");
  const [newType, setNewType] = useState<any>("day");

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/shifts"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(shiftsList);
      }
    } catch {
      setData(shiftsList);
    } finally {
      setLoading(false);
    }
  }, [shiftsList]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const filtered = useMemo(() => {
    return data.filter((s) => {
      const search = searchFilter.toLowerCase();
      return s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search);
    });
  }, [data, searchFilter]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "code", title: "Smena kodi", width: 140, icon: GridColumnIcon.HeaderString },
      { id: "name", title: "Smena nomi va ta'rifi", width: 280, icon: GridColumnIcon.HeaderString },
      { id: "startTime", title: "Boshlanishi", width: 110, icon: GridColumnIcon.HeaderTime },
      { id: "endTime", title: "Tugashi", width: 110, icon: GridColumnIcon.HeaderTime },
      { id: "durationHours", title: "Davomiyligi", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "shiftType", title: "Rejim turi", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "activeWorkers", title: "Faol xodimlar", width: 120, icon: GridColumnIcon.HeaderNumber },
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

      if (col.id === "durationHours") {
        return {
          kind: GridCellKind.Text,
          data: String(row.durationHours || 12),
          displayData: `${row.durationHours || 12} soat`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "activeWorkers") {
        const count = row.activeWorkers || 0;
        return {
          kind: GridCellKind.Text,
          data: String(count),
          displayData: `${count} kishi`,
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
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
    (shift: ShiftRecord) => {
      openTab({
        id: `shift-${shift.id}`,
        title: `${shift.name} (${shift.code})`,
        type: "shift-detail",
        module: "hr",
        documentData: shift,
      });
    },
    [openTab]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const shift = filtered[rowIndex];
      if (shift) handleOpenDetail(shift);
    },
    [filtered, handleOpenDetail]
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;

    const payload: Partial<ShiftRecord> = {
      code: newCode.trim() || `SHIFT-${Date.now().toString().slice(-4)}`,
      name: newName.trim(),
      startTime: newStart,
      endTime: newEnd,
      durationHours: 12,
      shiftType: newType,
      activeWorkers: 0,
      isActive: true,
    };

    try {
      const res = await fetch("/api/v1/hr/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        payload.id = json.id;
        upsertShift(payload as ShiftRecord);
        addNotification({
          title: "Smena qo'shildi",
          description: `${payload.name} grafigi saqlandi.`,
          severity: "success",
        });
        setIsAddOpen(false);
        fetchShifts();
        handleOpenDetail(payload as ShiftRecord);
      }
    } catch {
      payload.id = `shift-${Date.now()}`;
      upsertShift(payload as ShiftRecord);
      setIsAddOpen(false);
      handleOpenDetail(payload as ShiftRecord);
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
            <span>Yangi smena</span>
          </Button>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Smena nomi yoki kodi..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchShifts}
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
              <Clock className="size-4 text-primary" />
              Yangi Smena Grafigi Qo'shish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ishlab chiqarish sexlari uchun ish vaqti oralig'i kiritiladi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Smena kodi *</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="masalan: SHIFT-NIGHT-12"
                className="h-8 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Smena nomi *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="masalan: Smena B (Tungi 12 soat)"
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Boshlanish vaqti</Label>
                <Input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Tugash vaqti</Label>
                <Input
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Rejim turi</Label>
              <Select value={newType} onValueChange={(val) => { if (val) setNewType(val as any); }}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Kunduzgi (Day)</SelectItem>
                  <SelectItem value="night">Tungi (Night)</SelectItem>
                  <SelectItem value="daily">Kunlik ofis (09:00-18:00)</SelectItem>
                </SelectContent>
              </Select>
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
