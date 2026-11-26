"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  GridColumnIcon,
  Item,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Pencil, Plus, RefreshCw } from "lucide-react";
import type { CashCategoryRecord } from "@/lib/server/treasuryService";
import { apiJson, GROUP_LABEL, PNL_LABEL } from "./format";

const MANUAL_PNL = ["revenue", "cogs", "expense", "capex"] as const;

export function CashCategoriesGrid() {
  const { theme, updateGridStats } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [data, setData] = useState<CashCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CashCategoryRecord | null | undefined>(undefined);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const fetchData = useCallback(
    () =>
      apiJson<{ data: CashCategoryRecord[] }>("/api/v1/finance/cash-categories")
        .then((j) => setData(j.data))
        .catch(() => setData([]))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    updateGridStats?.(data.length, selection.rows.length);
  }, [data.length, selection.rows.length, updateGridStats]);

  const columns: GridColumn[] = useMemo(
    () => [
      { id: "name", title: "Nomi", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "direction", title: "Yo'nalish", width: 85, icon: GridColumnIcon.HeaderString },
      { id: "pnlType", title: "Hisobotda", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "group", title: "Guruh", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "isSystem", title: "Manba", width: 90, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Holat", width: 80, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [c, r] = cell;
      const col = columns[c];
      const row = data[r];
      const empty: GridCell = { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      if (!col?.id || !row) return empty;
      const dim = row.isActive ? undefined : { textDark: "#9ca3af" };
      const text = (v: string): GridCell => ({
        kind: GridCellKind.Text,
        data: v,
        displayData: v,
        allowOverlay: false,
        themeOverride: dim,
      });
      switch (col.id) {
        case "direction":
          return text(row.direction === "in" ? "Kirim" : "Chiqim");
        case "pnlType":
          return text(PNL_LABEL[row.pnlType] ?? row.pnlType);
        case "group":
          return text(GROUP_LABEL[row.group] ?? row.group);
        case "isSystem":
          return text(row.isSystem ? "Tizim" : "Qo'lda");
        case "status":
          return text(row.isActive ? "Faol" : "O'chirilgan");
        default:
          return text(String((row as unknown as Record<string, unknown>)[col.id] ?? ""));
      }
    },
    [columns, data]
  );

  const selected = selection.rows.length === 1 ? data[selection.rows.first() ?? -1] : undefined;

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setEditing(null)}>
            <Plus className="size-3.5" />
            <span>Yangi</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            disabled={!selected}
            onClick={() => selected && setEditing(selected)}
          >
            <Pencil className="size-3.5" />
            <span>Tahrirlash</span>
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          disabled={loading}
          aria-label="Yangilash"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden">
        <div className="absolute inset-0">
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={data.length}
            getCellContent={getCellContent}
            rowMarkers="both"
            headerHeight={28}
            rowHeight={27}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellActivated={([, r]) => data[r] && setEditing(data[r])}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            smoothScrollY
          />
        </div>
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 text-xs">
          {editing !== undefined && (
            <CategoryForm category={editing} onClose={() => setEditing(undefined)} onSaved={fetchData} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: CashCategoryRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const locked = Boolean(category?.isSystem);
  const [name, setName] = useState(category?.name ?? "");
  const [direction, setDirection] = useState<"in" | "out">(category?.direction ?? "out");
  const [pnlType, setPnlType] = useState<string>(category?.pnlType ?? "expense");
  const [group, setGroup] = useState(category?.group ?? "other");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const body = locked ? { name, group } : { name, direction, pnlType, group, isActive };
      await apiJson(category ? `/api/v1/finance/cash-categories/${category.id}` : "/api/v1/finance/cash-categories", {
        method: category ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader className="px-4 py-3 border-b border-border">
        <DialogTitle className="text-sm flex items-center gap-1.5">
          {locked && <Lock className="size-3.5 text-muted-foreground" />}
          {category ? "Modda" : "Yangi modda"}
        </DialogTitle>
      </DialogHeader>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nomi</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Yo&apos;nalish</Label>
          <Select
            value={direction}
            onValueChange={(v) => {
              if (!v) return;
              setDirection(v as "in" | "out");
              setPnlType(v === "in" ? "revenue" : "expense");
            }}
            disabled={locked || Boolean(category)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{direction === "in" ? "Kirim" : "Chiqim"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out" className="text-xs">Chiqim</SelectItem>
              <SelectItem value="in" className="text-xs">Kirim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hisobotda</Label>
          <Select value={pnlType} onValueChange={(v) => v && setPnlType(v as string)} disabled={locked}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{PNL_LABEL[pnlType] ?? pnlType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MANUAL_PNL.filter((p) => (direction === "in" ? p === "revenue" : p !== "revenue")).map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {PNL_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Guruh</Label>
          <Select value={group} onValueChange={(v) => v && setGroup(v as string)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{GROUP_LABEL[group] ?? group}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GROUP_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-xs self-end h-8">
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={locked} />
          Faol
        </label>
        {error && <div className="col-span-2 text-destructive text-[11px]">{error}</div>}
      </div>
      <DialogFooter className="px-4 py-3 border-t border-border">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
          Bekor
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
          {saving ? "Saqlanmoqda" : "Saqlash"}
        </Button>
      </DialogFooter>
    </>
  );
}
