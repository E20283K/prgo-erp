"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Clock,
  Sparkles,
  ArrowUpRight,
  Package,
  ArrowUp,
  ArrowDown,
  Copy,
  Factory,
  CheckCircle2,
  Play,
  PauseCircle,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridColumnIcon,
  EditableGridCell,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { RouteStep } from "../types";
import { OrderReadinessRouteCard } from "../OrderReadinessRouteCard";

interface OperationsTabProps {
  workOrderId?: string;
  fallbackData?: {
    customer?: string;
    product?: string;
    machine?: string;
    quantity?: number;
    deadline?: string;
    department?: string;
  };
  operations: RouteStep[];
  setOperations: React.Dispatch<React.SetStateAction<RouteStep[]>>;
  opSelection: GridSelection;
  setOpSelection: React.Dispatch<React.SetStateAction<GridSelection>>;
  onOpenAddOperation: () => void;
  onOpenEditOperation: (index: number) => void;
  onDeleteSelectedOperation: () => void;
  isDark: boolean;
  isOperator?: boolean;
  onMarkUnsaved: () => void;
  onSyncFromPlan?: () => void;
  onOpenInTimeline?: (opId: string) => void;
  onOpenPackaging?: () => void;
  isPacked?: boolean;
  packagesCount?: number;
}

const STATUS_LABELS: Record<RouteStep["status"], string> = {
  Queued: "Navbatda",
  "In Progress": "Jarayonda",
  Paused: "To'xtalish",
  Finished: "Yakunlandi",
};

export function OperationsTab({
  workOrderId,
  fallbackData,
  operations,
  setOperations,
  opSelection,
  setOpSelection,
  onOpenAddOperation,
  onOpenEditOperation,
  onDeleteSelectedOperation,
  isDark,
  isOperator = false,
  onMarkUnsaved,
  onSyncFromPlan,
  onOpenInTimeline,
  onOpenPackaging,
  packagesCount,
}: OperationsTabProps) {
  const selectedOpRow = opSelection.rows.first();
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  const totalDuration = useMemo(() => {
    return Number(
      operations.reduce((sum, op) => sum + (Number(op.duration) || 0), 0).toFixed(1)
    );
  }, [operations]);

  const totalPlannedCost = useMemo(() => {
    return operations.reduce((sum, op) => sum + (Number(op.plannedCostUsd) || 0), 0);
  }, [operations]);

  const totalPiecework = useMemo(() => {
    return operations.reduce((sum, op) => sum + (Number(op.pieceworkTotalUsd) || 0), 0);
  }, [operations]);

  const finishedCount = useMemo(() => {
    return operations.filter((op) => op.status === "Finished").length;
  }, [operations]);

  const baseColumns = useMemo<GridColumn[]>(() => {
    const cols: GridColumn[] = [
      { id: "step", title: "Tartib #", width: 72, icon: GridColumnIcon.HeaderNumber },
      { id: "tariffCode", title: "Tarif", width: 95, icon: GridColumnIcon.HeaderCode },
      { id: "name", title: "Texnologik operatsiya", width: 250, icon: GridColumnIcon.HeaderString },
      { id: "machine", title: "Uskuna / Ish markazi", width: 195, icon: GridColumnIcon.HeaderLookup },
      { id: "tooling", title: "Texnologik jihoz", width: 170, icon: GridColumnIcon.HeaderString },
      { id: "operator", title: "Operator / Brigada", width: 165, icon: GridColumnIcon.HeaderString },
      { id: "status", title: "Holat", width: 115, icon: GridColumnIcon.HeaderSingleValue },
      { id: "qtyCompleted", title: "Bajarildi", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "duration", title: "Me'yoriy vaqt", width: 110, icon: GridColumnIcon.HeaderTime },
    ];

    if (!isOperator) {
      cols.push(
        { id: "rate", title: "Stavka", width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: "plannedCost", title: "Rejaviy tannarx ($)", width: 135, icon: GridColumnIcon.HeaderMath },
        { id: "piecework", title: "Sdelka FOT ($)", width: 115, icon: GridColumnIcon.HeaderMath }
      );
    }

    return cols;
  }, [isOperator]);

  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const opColumns = useMemo<GridColumn[]>(() => {
    return baseColumns.map((c) =>
      c.id && colWidths[c.id] ? { ...c, width: colWidths[c.id] } : c
    );
  }, [baseColumns, colWidths]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (!column.id) return;
    setColWidths((prev) => ({ ...prev, [column.id!]: Math.max(60, newSize) }));
  }, []);

  const handleMoveOperation = useCallback(
    (direction: "up" | "down") => {
      if (!hasSelectedOp || selectedOpRow === undefined) return;
      const targetIdx = direction === "up" ? selectedOpRow - 1 : selectedOpRow + 1;
      if (targetIdx < 0 || targetIdx >= operations.length) return;

      const updated = [...operations];
      const [moved] = updated.splice(selectedOpRow, 1);
      updated.splice(targetIdx, 0, moved);

      const renumbered = updated.map((op, idx) => ({
        ...op,
        stepNumber: (idx + 1) * 10,
      }));

      setOperations(renumbered);
      setOpSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(targetIdx),
      });
      onMarkUnsaved();
    },
    [hasSelectedOp, selectedOpRow, operations, setOperations, setOpSelection, onMarkUnsaved]
  );

  const handleDuplicateOperation = useCallback(() => {
    if (!hasSelectedOp || selectedOpRow === undefined) return;
    const source = operations[selectedOpRow];
    if (!source) return;

    const duplicated: RouteStep = {
      ...source,
      id: `op-${Date.now()}`,
      name: `${source.name} (Nusxa)`,
      status: "Queued",
      qtyCompleted: `0 / ${(fallbackData?.quantity || 0).toLocaleString()}`,
    };

    const updated = [...operations];
    updated.splice(selectedOpRow + 1, 0, duplicated);
    const renumbered = updated.map((op, idx) => ({
      ...op,
      stepNumber: (idx + 1) * 10,
    }));

    setOperations(renumbered);
    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(selectedOpRow + 1),
    });
    onMarkUnsaved();
  }, [hasSelectedOp, selectedOpRow, operations, fallbackData?.quantity, setOperations, setOpSelection, onMarkUnsaved]);

  const handleSetRowStatus = useCallback(
    (status: RouteStep["status"]) => {
      if (!hasSelectedOp || selectedOpRow === undefined) return;
      const updated = [...operations];
      updated[selectedOpRow] = {
        ...updated[selectedOpRow],
        status,
      };
      setOperations(updated);
      onMarkUnsaved();
    },
    [hasSelectedOp, selectedOpRow, operations, setOperations, onMarkUnsaved]
  );

  const getOpCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const op = operations[row];
      const column = opColumns[col];
      if (!op || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      switch (column.id) {
        case "step":
          return {
            kind: GridCellKind.Number,
            data: op.stepNumber,
            displayData: `#${op.stepNumber}`,
            allowOverlay: false,
            themeOverride: {
              baseFontStyle: "bold 12px monospace",
              textDark: isDark ? "#93c5fd" : "#1d4ed8",
            },
          };
        case "tariffCode":
          return {
            kind: GridCellKind.Text,
            data: op.tariffCode || "—",
            displayData: op.tariffCode || "—",
            allowOverlay: false,
            themeOverride: {
              baseFontStyle: "11px monospace",
              textDark: op.tariffCode
                ? isDark
                  ? "#cbd5e1"
                  : "#334155"
                : isDark
                ? "#52525b"
                : "#94a3b8",
            },
          };
        case "name":
          return {
            kind: GridCellKind.Text,
            data: op.name,
            displayData: op.name,
            allowOverlay: !isOperator,
            themeOverride: {
              baseFontStyle: "500 12px sans-serif",
            },
          };
        case "machine":
          return {
            kind: GridCellKind.Text,
            data: op.machine || "",
            displayData: op.machine || "Belgilanmagan",
            allowOverlay: !isOperator,
            themeOverride: {
              textDark: op.machine
                ? isDark
                  ? "#f4f4f5"
                  : "#0f172a"
                : isDark
                ? "#71717a"
                : "#94a3b8",
            },
          };
        case "tooling": {
          const toolText = op.toolingName || op.toolingId || "—";
          return {
            kind: GridCellKind.Text,
            data: toolText === "—" ? "" : toolText,
            displayData: toolText,
            allowOverlay: !isOperator,
            themeOverride: {
              textDark:
                toolText !== "—"
                  ? isDark
                    ? "#fcd34d"
                    : "#b45309"
                  : isDark
                  ? "#52525b"
                  : "#94a3b8",
            },
          };
        }
        case "operator": {
          const hasOp = Boolean(op.operator && op.operator.trim() && op.operator !== "Unassigned");
          return {
            kind: GridCellKind.Text,
            data: hasOp ? op.operator : "",
            displayData: hasOp ? op.operator : "Belgilanmagan",
            allowOverlay: !isOperator,
            themeOverride: {
              textDark: hasOp
                ? isDark
                  ? "#e4e4e7"
                  : "#18181b"
                : isDark
                ? "#71717a"
                : "#94a3b8",
            },
          };
        }
        case "status": {
          const st = op.status || "Queued";
          const label = STATUS_LABELS[st] || st;
          const color =
            st === "Finished"
              ? isDark
                ? "#4ade80"
                : "#16a34a"
              : st === "In Progress"
              ? isDark
                ? "#60a5fa"
                : "#2563eb"
              : st === "Paused"
              ? isDark
                ? "#fbbf24"
                : "#d97706"
              : isDark
              ? "#a1a1aa"
              : "#64748b";
          return {
            kind: GridCellKind.Text,
            data: st,
            displayData: label,
            allowOverlay: false,
            themeOverride: {
              textDark: color,
              baseFontStyle: "600 11px sans-serif",
            },
          };
        }
        case "qtyCompleted": {
          const qText = op.qtyCompleted || `0 / ${(fallbackData?.quantity || 0).toLocaleString()}`;
          return {
            kind: GridCellKind.Text,
            data: qText,
            displayData: qText,
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "11px monospace",
              textDark: isDark ? "#d4d4d8" : "#334155",
            },
          };
        }
        case "duration":
          return {
            kind: GridCellKind.Number,
            data: op.duration || 1,
            displayData: `${op.duration || 1} soat`,
            allowOverlay: !isOperator,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "12px monospace",
            },
          };
        case "rate": {
          const rateText =
            op.rateUsd !== undefined && op.rateUsd > 0
              ? `$${op.rateUsd} / ${op.calcUnit || "birlik"}`
              : "—";
          return {
            kind: GridCellKind.Text,
            data: rateText,
            displayData: rateText,
            allowOverlay: false,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "11px monospace",
              textDark: isDark ? "#a1a1aa" : "#64748b",
            },
          };
        }
        case "plannedCost": {
          const val = op.plannedCostUsd || 0;
          return {
            kind: GridCellKind.Number,
            data: val,
            displayData: val > 0 ? `$${val.toFixed(2)}` : "—",
            allowOverlay: !isOperator,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "600 12px monospace",
              textDark: val > 0 ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#52525b" : "#94a3b8"),
            },
          };
        }
        case "piecework": {
          const val = op.pieceworkTotalUsd || 0;
          return {
            kind: GridCellKind.Number,
            data: val,
            displayData: val > 0 ? `$${val.toFixed(2)}` : "—",
            allowOverlay: !isOperator,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "600 12px monospace",
              textDark: val > 0 ? (isDark ? "#34d399" : "#059669") : (isDark ? "#52525b" : "#94a3b8"),
            },
          };
        }
        default:
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }
    },
    [operations, opColumns, isDark, isOperator, fallbackData?.quantity]
  );

  const onOpCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = opColumns[col];
      const target = operations[row];
      if (!target || !column) return;

      const updated = [...operations];
      const nextOp = { ...target };

      if (column.id === "name" && newValue.kind === GridCellKind.Text && !isOperator) {
        nextOp.name = newValue.data.toString();
      } else if (column.id === "machine" && newValue.kind === GridCellKind.Text && !isOperator) {
        nextOp.machine = newValue.data.toString();
      } else if (column.id === "tooling" && newValue.kind === GridCellKind.Text && !isOperator) {
        nextOp.toolingName = newValue.data.toString();
      } else if (column.id === "operator" && newValue.kind === GridCellKind.Text && !isOperator) {
        nextOp.operator = newValue.data.toString();
      } else if (column.id === "qtyCompleted" && newValue.kind === GridCellKind.Text) {
        nextOp.qtyCompleted = newValue.data.toString();
      } else if (column.id === "duration" && newValue.kind === GridCellKind.Number && !isOperator) {
        nextOp.duration = Math.max(0.1, Number(newValue.data) || 0.5);
      } else if (column.id === "plannedCost" && newValue.kind === GridCellKind.Number && !isOperator) {
        nextOp.plannedCostUsd = Math.max(0, Number(newValue.data) || 0);
      } else if (column.id === "piecework" && newValue.kind === GridCellKind.Number && !isOperator) {
        nextOp.pieceworkTotalUsd = Math.max(0, Number(newValue.data) || 0);
      }

      updated[row] = nextOp;
      setOperations(updated);
      onMarkUnsaved();
    },
    [operations, opColumns, isOperator, setOperations, onMarkUnsaved]
  );

  return (
    <TabsContent
      value="operations"
      className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background select-none data-[state=inactive]:hidden"
    >
      {/* 0. Pre-Flight Readiness & Production Route (Full Stage-Gate Bar) */}
      {workOrderId && (
        <OrderReadinessRouteCard
          variant="horizontal"
          workOrderId={workOrderId}
          fallbackData={fallbackData}
        />
      )}

      {/* 1. Operations Toolbar */}
      <div className="h-9 border-b border-border bg-card px-2.5 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          {!isOperator && (
            <Button
              onClick={onOpenAddOperation}
              size="sm"
              className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bosqich qo&apos;shish</span>
            </Button>
          )}

          {onOpenPackaging && (
            <Button
              onClick={onOpenPackaging}
              variant="outline"
              size="sm"
              className="h-6.5 px-2.5 text-xs font-medium gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 rounded cursor-pointer"
              title="Mahsulotni qutilarga taqsimlash va quti pasportlarini chop etish"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Qadoqlash</span>
              {packagesCount !== undefined && packagesCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono ml-0.5">
                  {packagesCount} quti
                </Badge>
              )}
            </Button>
          )}

          {hasSelectedOp && (
            <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
              <Separator orientation="vertical" className="h-4 mx-0.5" />

              {!isOperator && (
                <>
                  <Button
                    onClick={() => onOpenEditOperation(selectedOpRow)}
                    variant="outline"
                    size="sm"
                    className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer text-amber-600 dark:text-amber-400 border-amber-500/30"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span className="hidden sm:inline">Tahrirlash</span>
                  </Button>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          onClick={() => handleMoveOperation("up")}
                          disabled={selectedOpRow === 0}
                          variant="outline"
                          size="icon-sm"
                          className="h-6.5 w-6.5 p-0 rounded cursor-pointer disabled:opacity-40"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      Yuqoriga surish (Alt+↑)
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          onClick={() => handleMoveOperation("down")}
                          disabled={selectedOpRow === operations.length - 1}
                          variant="outline"
                          size="icon-sm"
                          className="h-6.5 w-6.5 p-0 rounded cursor-pointer disabled:opacity-40"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      Pastga surish (Alt+↓)
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          onClick={handleDuplicateOperation}
                          variant="outline"
                          size="icon-sm"
                          className="h-6.5 w-6.5 p-0 rounded cursor-pointer text-indigo-600 dark:text-indigo-400"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      Bosqichni nusxalash
                    </TooltipContent>
                  </Tooltip>
                </>
              )}

              {onOpenInTimeline && (
                <Button
                  onClick={() => onOpenInTimeline(operations[selectedOpRow].id)}
                  variant="outline"
                  size="sm"
                  className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="Ushbu bosqichning sexdagi bajarilishi va smena jurnalini ochish"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Smena jurnali</span>
                </Button>
              )}

              {!isOperator && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={onDeleteSelectedOperation}
                        variant="ghost"
                        size="icon-sm"
                        className="h-6.5 w-6.5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-xs">
                    Bosqichni o&apos;chirish (Del)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0 pl-2 ml-auto whitespace-nowrap">
          <span>
            Bosqichlar:{" "}
            <strong className="text-foreground font-mono">
              {finishedCount}/{operations.length}
            </strong>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" /> Me&apos;yor:{" "}
            <strong className="text-foreground font-mono">{totalDuration} soat</strong>
          </span>
          {!isOperator && totalPlannedCost > 0 && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1 font-mono">
                Tannarx:{" "}
                <strong className="text-blue-600 dark:text-blue-400 font-semibold">
                  ${totalPlannedCost.toFixed(2)}
                </strong>
              </span>
            </>
          )}
          {!isOperator && totalPiecework > 0 && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1 font-mono">
                Sdelka FOT:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ${totalPiecework.toFixed(2)}
                </strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Glide Data Grid */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 w-full h-full relative"
            id="glide-wo-route-grid-root"
            onKeyDown={(e) => {
              if (!isOperator && e.key === "Insert") {
                e.preventDefault();
                onOpenAddOperation();
              } else if (!isOperator && e.key === "Delete" && hasSelectedOp) {
                e.preventDefault();
                onDeleteSelectedOperation();
              } else if (!isOperator && e.altKey && e.key === "ArrowUp" && hasSelectedOp) {
                e.preventDefault();
                handleMoveOperation("up");
              } else if (!isOperator && e.altKey && e.key === "ArrowDown" && hasSelectedOp) {
                e.preventDefault();
                handleMoveOperation("down");
              } else if (e.key === "Enter" && hasSelectedOp && !isOperator) {
                e.preventDefault();
                onOpenEditOperation(selectedOpRow);
              }
            }}
          >
            <DataEditor
              getCellContent={getOpCellContent}
              columns={opColumns}
              rows={operations.length}
              onCellEdited={onOpCellEdited}
              onColumnResize={handleColumnResize}
              gridSelection={opSelection}
              onGridSelectionChange={setOpSelection}
              onCellContextMenu={(cell) => {
                const [, row] = cell;
                setOpSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row),
                });
              }}
              onCellActivated={(cell) => {
                const [, row] = cell;
                if (isOperator) {
                  if (onOpenInTimeline && operations[row]) {
                    onOpenInTimeline(operations[row].id);
                  }
                } else {
                  onOpenEditOperation(row);
                }
              }}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />

            {operations.length === 0 && (
              <div className="absolute inset-0 top-7 flex flex-col items-center justify-center bg-background/60 z-10 select-none gap-2">
                <Factory className="size-8 text-muted-foreground/30" />
                <span className="text-xs font-medium text-muted-foreground">
                  Texnologik marshrut bosqichlari kiritilmagan
                </span>
                {!isOperator && (
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      onClick={onOpenAddOperation}
                      size="sm"
                      className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Bosqich qo&apos;shish</span>
                    </Button>
                    {onSyncFromPlan && (
                      <Button
                        onClick={onSyncFromPlan}
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                      >
                        <Sparkles className="size-3.5 text-amber-500" />
                        <span>Rejadan shakllantirish</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          {!isOperator && (
            <ContextMenuItem onClick={onOpenAddOperation} className="gap-2 cursor-pointer">
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span>Bosqich qo&apos;shish</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
            </ContextMenuItem>
          )}

          {hasSelectedOp && !isOperator && (
            <>
              <ContextMenuItem onClick={() => onOpenEditOperation(selectedOpRow)} className="gap-2 cursor-pointer">
                <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                <span>Bosqichni tahrirlash</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
              </ContextMenuItem>

              <ContextMenuItem onClick={handleDuplicateOperation} className="gap-2 cursor-pointer">
                <Copy className="w-3.5 h-3.5 text-indigo-500" />
                <span>Nusxalash</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => handleSetRowStatus("In Progress")}
                className="gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-blue-500" />
                <span>Holat: Jarayonda</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleSetRowStatus("Paused")}
                className="gap-2 cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Holat: To&apos;xtalish</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleSetRowStatus("Finished")}
                className="gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Holat: Yakunlandi</span>
              </ContextMenuItem>
            </>
          )}

          {hasSelectedOp && onOpenInTimeline && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onOpenInTimeline(operations[selectedOpRow].id)}
                className="gap-2 cursor-pointer text-blue-600 dark:text-blue-400"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Smena jurnalida ochish</span>
              </ContextMenuItem>
            </>
          )}

          {hasSelectedOp && !isOperator && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={onDeleteSelectedOperation}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bosqichni o&apos;chirish</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </TabsContent>
  );
}
