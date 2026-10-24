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
import { PieceworkRecord } from "../types";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Award, Plus, Search, RefreshCw, Printer, CheckCircle2 } from "lucide-react";

export function PieceworkGrid() {
  const { theme, openTab, piecework, upsertPiecework, employees, updateGridStats, addNotification } =
    useWorkspaceStore();

  const isDark = theme === "dark";
  const [data, setData] = useState<PieceworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [woId, setWoId] = useState("WOOF-26-0351");
  const [machine, setMachine] = useState("Mark Andy 2200 #1");
  const [operation, setOperation] = useState("Flekso bosma (Samo-kleyka yorliq)");
  const [qty, setQty] = useState("25000");
  const [unit, setUnit] = useState("dona");
  const [rate, setRate] = useState("18.5");

  const fetchPiecework = useCallback(async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/v1/hr/piecework"),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setData(json.data);
      } else {
        setData(piecework);
      }
    } catch {
      setData(piecework);
    } finally {
      setLoading(false);
    }
  }, [piecework]);

  useEffect(() => {
    fetchPiecework();
  }, [fetchPiecework]);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const s = searchFilter.toLowerCase();
      const matchSearch =
        p.employeeName.toLowerCase().includes(s) ||
        p.workOrderId.toLowerCase().includes(s) ||
        (p.operationName || p.operation || "").toLowerCase().includes(s);

      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, searchFilter, statusFilter]);

  const totalSum = useMemo(() => {
    return filtered.reduce((sum, p) => sum + p.totalAmount, 0);
  }, [filtered]);

  useEffect(() => {
    if (updateGridStats) {
      updateGridStats(filtered.length, selection.rows.length);
    }
  }, [filtered.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "workDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
      { id: "workOrderId", title: "Work Order №", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "employeeName", title: "Bajaruvchi usta", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "machine", title: "Stanok / Uskuna", width: 160, icon: GridColumnIcon.HeaderString },
      { id: "operationName", title: "Bajarilgan operatsiya", width: 240, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Hajm", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "rate", title: "Tarif (UZS)", width: 100, icon: GridColumnIcon.HeaderNumber },
      { id: "totalAmount", title: "Summa (UZS)", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "status", title: "Holati", width: 105, icon: GridColumnIcon.HeaderString },
      { id: "approvedBy", title: "Tasdiqladi", width: 170, icon: GridColumnIcon.HeaderString },
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

      if (col.id === "workOrderId") {
        return {
          kind: GridCellKind.Text,
          data: row.workOrderId,
          displayData: row.workOrderId,
          allowOverlay: true,
          themeOverride: { textDark: "#2563eb", baseFontStyle: "bold 11px monospace" },
        };
      }

      if (col.id === "totalAmount") {
        return {
          kind: GridCellKind.Text,
          data: String(row.totalAmount),
          displayData: `${row.totalAmount.toLocaleString("uz-UZ")} UZS`,
          allowOverlay: true,
          themeOverride: { textDark: "#059669", baseFontStyle: "bold 12px monospace" },
        };
      }

      if (col.id === "quantity") {
        const q = row.completedQuantity || row.quantity || 0;
        return {
          kind: GridCellKind.Text,
          data: String(q),
          displayData: q.toLocaleString("uz-UZ"),
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "rate") {
        const r = row.pieceRate || row.rate || 0;
        return {
          kind: GridCellKind.Text,
          data: String(r),
          displayData: r.toLocaleString("uz-UZ"),
          allowOverlay: true,
          themeOverride: { baseFontStyle: "12px monospace" },
        };
      }

      if (col.id === "operationName") {
        const op = row.operationName || row.operation || "";
        return { kind: GridCellKind.Text, data: op, displayData: op, allowOverlay: true };
      }

      if (col.id === "machine") {
        const m = row.machineCode || row.machine || "";
        return { kind: GridCellKind.Text, data: m, displayData: m, allowOverlay: true };
      }

      if (col.id === "workDate") {
        const d = row.workDate || row.date || "";
        return { kind: GridCellKind.Text, data: d, displayData: d, allowOverlay: true };
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

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const pw = filtered[rowIndex];
      if (pw) {
        openTab({
          id: `emp-${pw.employeeId}`,
          title: `${pw.employeeName} (${pw.badgeNumber || pw.badgeNo})`,
          type: "employee-detail",
          module: "hr",
          activeLevel3Tab: "piecework",
        });
      }
    },
    [filtered, openTab]
  );

  const handleCreate = async () => {
    const emp = employees.find((e) => e.id === selectedEmpId) || employees[0];
    if (!emp) return;

    const quantityNum = Number(qty) || 0;
    const rateNum = Number(rate) || 0;
    const total = Math.round(quantityNum * rateNum * (emp.pieceworkMultiplier || 1.0));

    const payload: Partial<PieceworkRecord> = {
      workDate: new Date().toISOString().split("T")[0],
      workOrderId: woId,
      employeeId: emp.id,
      badgeNumber: emp.badgeNumber || emp.badgeNo || "",
      employeeName: emp.fullName,
      department: emp.departmentName || emp.department || "",
      machineCode: machine,
      operationCode: "OP-" + operation.slice(0, 5).toUpperCase(),
      operationName: operation,
      completedQuantity: quantityNum,
      unit,
      pieceRate: rateNum,
      totalAmount: total,
      status: "verified",
      approvedBy: "Sex Masteri",
    };

    try {
      const res = await fetch("/api/v1/hr/piecework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        payload.id = json.id;
        upsertPiecework(payload as PieceworkRecord);
        addNotification({
          title: "Ishbay naryad kiritildi",
          description: `${emp.fullName} uchun ${total.toLocaleString("uz-UZ")} UZS hisoblandi.`,
          severity: "success",
        });
        setIsAddOpen(false);
        fetchPiecework();
      }
    } catch {
      payload.id = `pw-${Date.now()}`;
      upsertPiecework(payload as PieceworkRecord);
      setIsAddOpen(false);
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
            onClick={() => {
              setSelectedEmpId(employees[0]?.id || "");
              setIsAddOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Naryad qo'shish</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status Segment Filter Pills */}
          <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
            {[
              { key: "ALL", label: "Hammasi" },
              { key: "verified", label: "Tasdiqlangan" },
              { key: "approved", label: "Oylikka kiritilgan" },
              { key: "paid", label: "To'langan" },
              { key: "draft", label: "Qoralama" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  statusFilter === key
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="F.I.O. yoki Work Order..."
              className="pl-7 h-7 text-xs bg-background border-input rounded"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={fetchPiecework}
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
            {totalSum.toLocaleString("uz-UZ")} UZS
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

      {/* ── Add Piecework Modal ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="size-4 text-amber-600" />
              Yangi Ishbay Naryad (Sdelka) Kiritish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bajarilgan ish hajmi bo'yicha xodim hisobiga summa kiritiladi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Bajaruvchi xodim *</Label>
              <Select value={selectedEmpId} onValueChange={(val) => { if (val) setSelectedEmpId(val); }}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName} ({e.badgeNumber || e.badgeNo}) — {e.positionTitle || e.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Work Order № *</Label>
                <Input
                  value={woId}
                  onChange={(e) => setWoId(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Stanok / Uskuna</Label>
                <Input
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Bajarilgan operatsiya nomi *</Label>
              <Input
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="h-8"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Hajm</Label>
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Birlik</Label>
                <Select value={unit} onValueChange={(val) => { if (val) setUnit(val); }}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dona">dona</SelectItem>
                    <SelectItem value="metr">metr</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="partiya">partiya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Tarif (UZS)</Label>
                <Input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div className="p-2.5 rounded border bg-muted/20 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Hisoblangan jami summa:</span>
              <span className="font-mono font-bold text-sm text-emerald-600">
                {(Number(qty) * Number(rate)).toLocaleString("uz-UZ")} UZS
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleCreate}>
              <CheckCircle2 className="size-3.5" />
              Naryadni saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
