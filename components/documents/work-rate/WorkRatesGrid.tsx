"use client";

import React from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  GridColumnIcon,
  GridSelection,
  CompactSelection,
  EditableGridCell,
  Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Plus, Save, Trash2, Search, Edit3, Archive, ArchiveRestore, Hammer } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { formatNumberWithSpaces } from "@/components/documents/common/DocumentShell";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { TARIFF_CALC_UNITS } from "@/components/documents/tariff/types";
import type { WorkRateRecord } from "./types";

const emptyRecord = (): WorkRateRecord => ({
  id: "",
  code: "",
  name: "",
  department: "",
  defaultMachineId: null,
  unit: "1,000 sheets",
  unitDivisor: 1000,
  currency: "UZS",
  pieceRate: 0,
  helperPieceRate: 0,
  status: "Active",
  notes: "",
});

const unitLabel = (unit: string) => TARIFF_CALC_UNITS.find((u) => u.value === unit)?.label || unit;

const INLINE_EDIT_COLUMNS = ["name", "department", "pieceRate", "helperPieceRate"];

/**
 * Operation catalog (Operatsiyalar): route steps pick name, default machine and piecework pay from here.
 * Glide grid like the other registries: simple fields edit in the cell, the rest in the side panel.
 */
export function WorkRatesGrid() {
  const { workRates, machines, isLoading, theme, addNotification } = useWorkspaceStore(
    useShallow((s) => ({
      workRates: s.workRates,
      machines: s.machines,
      isLoading: s.isWorkRatesLoading,
      theme: s.theme,
      addNotification: s.addNotification,
    }))
  );
  const isDark = theme === "dark";

  const [query, setQuery] = React.useState("");
  const [selection, setSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [draft, setDraft] = React.useState<WorkRateRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<WorkRateRecord | null>(null);

  React.useEffect(() => {
    const st = useWorkspaceStore.getState();
    st.fetchWorkRates();
    if (st.machines.length === 0 && st.loadMachines) st.loadMachines();
  }, []);

  const machineName = React.useCallback(
    (id?: string | null) => (id ? machines.find((m) => m.id === id)?.name || "—" : "—"),
    [machines]
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workRates;
    return workRates.filter((r) => `${r.code} ${r.name} ${r.department}`.toLowerCase().includes(q));
  }, [workRates, query]);

  const columns = React.useMemo<GridColumn[]>(
    () => [
      { id: "code", title: "Kod", width: 90, icon: GridColumnIcon.HeaderCode },
      { id: "name", title: "Operatsiya", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "department", title: "Bo'lim", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "machine", title: "Standart uskuna", width: 210, icon: GridColumnIcon.HeaderLookup },
      { id: "unit", title: "Birlik", width: 190, icon: GridColumnIcon.HeaderSingleValue },
      { id: "pieceRate", title: "Sdelka", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "helperPieceRate", title: "Yordamchi sdelka", width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "currency", title: "Valyuta", width: 80, icon: GridColumnIcon.HeaderSingleValue },
      { id: "status", title: "Holat", width: 90, icon: GridColumnIcon.HeaderSingleValue },
    ],
    []
  );

  const muted = isDark ? "#71717a" : "#94a3b8";

  const getCellContent = React.useCallback(
    ([col, row]: Item): GridCell => {
      const r = rows[row];
      const id = columns[col]?.id;
      if (!r || !id) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      const archived = r.status === "Archived";
      const text = (value: string, editable = false, mono = false): GridCell => ({
        kind: GridCellKind.Text,
        data: value,
        displayData: value || "—",
        allowOverlay: editable,
        readonly: !editable,
        themeOverride: {
          ...(mono ? { baseFontStyle: "11px monospace" } : {}),
          ...(archived || !value ? { textDark: muted } : {}),
        },
      });
      const money = (value: number): GridCell => {
        const decimals = r.currency === "USD" ? 4 : 0;
        return {
          kind: GridCellKind.Number,
          data: value,
          displayData: value > 0 ? formatNumberWithSpaces(value, decimals) : "—",
          allowOverlay: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
            ...(archived || !(value > 0) ? { textDark: muted } : {}),
          },
        };
      };
      switch (id) {
        case "code":
          return text(r.code, false, true);
        case "name":
          return text(r.name, true);
        case "department":
          return text(r.department, true);
        case "machine":
          return text(r.defaultMachineId ? machineName(r.defaultMachineId) : "");
        case "unit":
          return text(unitLabel(r.unit));
        case "pieceRate":
          return money(r.pieceRate);
        case "helperPieceRate":
          return money(r.helperPieceRate);
        case "currency":
          return text(r.currency, false, true);
        case "status":
          return text(archived ? "Arxiv" : "Faol");
        default:
          return text("");
      }
    },
    [rows, columns, machineName, muted]
  );

  const save = React.useCallback(
    async (record: Partial<WorkRateRecord>) => {
      const saved = await useWorkspaceStore.getState().saveWorkRate(record);
      if (!saved) {
        addNotification({ title: "Saqlanmadi", description: record.name || "Operatsiya", severity: "error" });
      }
      return saved;
    },
    [addNotification]
  );

  // Simple fields are edited in the cell and saved right away.
  const onCellEdited = React.useCallback(
    ([col, row]: Item, value: EditableGridCell) => {
      const r = rows[row];
      const id = columns[col]?.id;
      if (!r || !id) return;
      let patch: Partial<WorkRateRecord> | null = null;
      if (value.kind === GridCellKind.Text && (id === "name" || id === "department")) {
        const v = value.data.trim();
        if (id === "name" && !v) return;
        patch = { [id]: v };
      } else if (value.kind === GridCellKind.Number && (id === "pieceRate" || id === "helperPieceRate")) {
        patch = { [id]: Math.max(0, Number(value.data) || 0) };
      }
      if (patch) void save({ ...r, ...patch });
    },
    [rows, columns, save]
  );

  const selectedRow = selection.rows.first();
  const selected = selectedRow !== undefined ? rows[selectedRow] : undefined;

  const openEditor = (r?: WorkRateRecord) => setDraft(r ? { ...r } : emptyRecord());

  const handleSaveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      addNotification({ title: "Saqlanmadi", description: "Operatsiya nomi kiritilmagan", severity: "error" });
      return;
    }
    setSaving(true);
    const saved = await save({ ...draft, id: draft.id || undefined });
    setSaving(false);
    if (saved) setDraft(null);
  };

  const toggleArchive = (r: WorkRateRecord) =>
    void save({ ...r, status: r.status === "Archived" ? "Active" : "Archived" });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const ok = await useWorkspaceStore.getState().deleteWorkRate(pendingDelete.id);
    if (!ok) addNotification({ title: "O'chirilmadi", description: pendingDelete.name, severity: "error" });
    setPendingDelete(null);
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
  };

  const patchDraft = (patch: Partial<WorkRateRecord>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const draftDecimals = draft?.currency === "USD" ? 4 : 0;

  return (
    <div className="flex flex-col h-full bg-background text-xs select-none">
      {/* Toolbar */}
      <div className="h-9 border-b border-border bg-card px-2.5 flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={() => openEditor()}
          className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 shadow-none"
        >
          <Plus className="size-3.5" />
          <span>Qo&apos;shish</span>
        </Button>
        {selected && (
          <>
            <Button size="sm" variant="outline" onClick={() => openEditor(selected)} className="h-6.5 px-2 text-xs gap-1">
              <Edit3 className="size-3" />
              <span>Tahrirlash</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setPendingDelete(selected)}
              className="h-6.5 w-6.5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3" />
            </Button>
          </>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          Operatsiyalar: <strong className="text-foreground font-mono">{workRates.length}</strong>
        </span>
        <div className="relative w-56">
          <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish"
            className="h-6.5 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Grid */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 w-full h-full relative">
            <DataEditor
              getCellContent={getCellContent}
              columns={columns}
              rows={rows.length}
              onCellEdited={onCellEdited}
              onCellActivated={([col, row]) => {
                // Text and number cells open their own editor; the rest go to the side panel.
                const id = columns[col]?.id;
                if (id && INLINE_EDIT_COLUMNS.includes(id)) return;
                if (rows[row]) openEditor(rows[row]);
              }}
              onCellContextMenu={([, row]) =>
                setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.fromSingleSelection(row) })
              }
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              rowMarkers="both"
              freezeColumns={2}
              smoothScrollX
              smoothScrollY
              width="100%"
              height="100%"
              headerHeight={28}
              rowHeight={28}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
            {rows.length === 0 && (
              <div className="absolute inset-0 top-7 flex flex-col items-center justify-center gap-2 bg-background/60 z-10">
                <Hammer className="size-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "Yuklanmoqda" : "Operatsiyalar kiritilmagan"}
                </span>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52 text-xs">
          <ContextMenuItem onClick={() => openEditor()} className="gap-2 cursor-pointer">
            <Plus className="size-3.5 text-blue-500" />
            <span>Qo&apos;shish</span>
          </ContextMenuItem>
          {selected && (
            <>
              <ContextMenuItem onClick={() => openEditor(selected)} className="gap-2 cursor-pointer">
                <Edit3 className="size-3.5 text-amber-500" />
                <span>Tahrirlash</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toggleArchive(selected)} className="gap-2 cursor-pointer">
                {selected.status === "Archived" ? (
                  <ArchiveRestore className="size-3.5 text-muted-foreground" />
                ) : (
                  <Archive className="size-3.5 text-muted-foreground" />
                )}
                <span>{selected.status === "Archived" ? "Faollashtirish" : "Arxivlash"}</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setPendingDelete(selected)}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span>O&apos;chirish</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Side panel: every field */}
      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="w-[420px] sm:w-[440px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 pr-6">
              <Hammer className="size-4 text-primary" />
              <SheetTitle className="text-sm font-semibold font-mono">{draft?.code || "Yangi operatsiya"}</SheetTitle>
              {draft?.status === "Archived" && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Arxiv
                </Badge>
              )}
            </div>
          </SheetHeader>

          {draft && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Operatsiya *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  placeholder="Masalan: Ofset bosma 4+0"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Standart uskuna</Label>
                  <Select
                    value={draft.defaultMachineId || "none"}
                    onValueChange={(val) => {
                      const m = machines.find((x) => x.id === val);
                      patchDraft({
                        defaultMachineId: val === "none" ? null : String(val),
                        department: draft.department || m?.department || "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue>{machineName(draft.defaultMachineId)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">—</SelectItem>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Bo&apos;lim</Label>
                  <Input
                    value={draft.department}
                    onChange={(e) => patchDraft({ department: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-medium">Birlik</Label>
                  <Select
                    value={draft.unit}
                    onValueChange={(val) => {
                      const u = TARIFF_CALC_UNITS.find((x) => x.value === val);
                      patchDraft({ unit: String(val), unitDivisor: u?.divisor ?? draft.unitDivisor });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue>{unitLabel(draft.unit)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TARIFF_CALC_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value} className="text-xs">
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Valyuta</Label>
                  <Select value={draft.currency} onValueChange={(val) => patchDraft({ currency: String(val) })}>
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue>{draft.currency}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS" className="text-xs">UZS</SelectItem>
                      <SelectItem value="USD" className="text-xs">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Sdelka</Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={draftDecimals}
                    value={draft.pieceRate}
                    onValueChange={(v) => patchDraft({ pieceRate: v.floatValue ?? 0 })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Yordamchi sdelka</Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={draftDecimals}
                    value={draft.helperPieceRate}
                    onValueChange={(v) => patchDraft({ helperPieceRate: v.floatValue ?? 0 })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Holat</Label>
                <Select
                  value={draft.status}
                  onValueChange={(val) => patchDraft({ status: val as WorkRateRecord["status"] })}
                >
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue>{draft.status === "Archived" ? "Arxiv" : "Faol"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active" className="text-xs">Faol</SelectItem>
                    <SelectItem value="Archived" className="text-xs">Arxiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Izoh</Label>
                <Textarea
                  value={draft.notes || ""}
                  onChange={(e) => patchDraft({ notes: e.target.value })}
                  className="min-h-16 text-xs"
                />
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDraft(null)}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              disabled={saving}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={handleSaveDraft}
            >
              <Save className="size-3.5" />
              <span>Saqlash</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Operatsiyani o&apos;chirish</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {pendingDelete?.code} — {pendingDelete?.name}. Bosqichlardagi bog&apos;lanish uziladi, nomlari saqlanib
              qoladi. Faqat arxivlash ham mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-8 text-xs bg-destructive hover:bg-destructive/90">
              O&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
