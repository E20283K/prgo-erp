"use client";

import React, { useMemo, useCallback } from "react";
import { Plus, ExternalLink, Trash2, Clock, Sparkles, ArrowUpRight, Package } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  onMarkUnsaved: () => void;
  onSyncFromPlan?: () => void;
  onOpenInTimeline?: (opId: string) => void;
  onOpenPackaging?: () => void;
  isPacked?: boolean;
  packagesCount?: number;
}

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
  onMarkUnsaved,
  onSyncFromPlan,
  onOpenInTimeline,
  onOpenPackaging,
  isPacked,
  packagesCount,
}: OperationsTabProps) {
  const selectedOpRow = opSelection.rows.first();
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  const totalDuration = useMemo(() => {
    return operations.reduce((sum, op) => sum + (Number(op.duration) || 0), 0);
  }, [operations]);

  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "step", title: "Step #", width: 80, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Texnologik Operatsiya (Description)", width: 300, icon: GridColumnIcon.HeaderString },
    { id: "machine", title: "Stanok / Uskuna (Work Center)", width: 240, icon: GridColumnIcon.HeaderLookup },
    { id: "tooling", title: "Texnologik Jihoz (Shtansforma / Qolip)", width: 240, icon: GridColumnIcon.HeaderString },
    { id: "operator", title: "Mas'ul Operator / Smena", width: 220, icon: GridColumnIcon.HeaderString },
    { id: "duration", title: "Me'yoriy vaqt (hrs)", width: 130, icon: GridColumnIcon.HeaderNumber },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: op.stepNumber, displayData: `#${op.stepNumber}`, allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: op.machine, displayData: op.machine, allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: op.toolingName || op.toolingId || "—", displayData: op.toolingName || op.toolingId || "—", allowOverlay: true };
    if (col === 4) return { kind: GridCellKind.Text, data: op.operator || "Unassigned", displayData: op.operator || "Unassigned", allowOverlay: true };
    if (col === 5) return { kind: GridCellKind.Number, data: op.duration || 1, displayData: `${op.duration || 1} soat`, allowOverlay: true };

    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [operations]);

  const onOpCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const updated = [...operations];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      updated[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      updated[row].machine = newValue.data.toString();
    } else if (col === 3 && newValue.kind === GridCellKind.Text) {
      updated[row].toolingName = newValue.data.toString();
    } else if (col === 4 && newValue.kind === GridCellKind.Text) {
      updated[row].operator = newValue.data.toString();
    } else if (col === 5 && newValue.kind === GridCellKind.Number) {
      updated[row].duration = Number(newValue.data);
    }
    setOperations(updated);
    onMarkUnsaved();
  }, [operations, setOperations, onMarkUnsaved]);

  return (
    <TabsContent value="operations" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background select-none">
      {/* 0. Pre-Flight Readiness & Production Route (Full Stage-Gate Bar) */}
      {workOrderId && (
        <OrderReadinessRouteCard
          variant="horizontal"
          workOrderId={workOrderId}
          fallbackData={fallbackData}
        />
      )}

      {/* 1. Operations Toolbar */}
      <div className="h-9 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Button
            onClick={onOpenAddOperation}
            size="sm"
            className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bosqich qo&apos;shish</span>
          </Button>

          {onOpenPackaging && (
            <Button
              onClick={onOpenPackaging}
              variant="outline"
              size="sm"
              className="h-6.5 px-2.5 text-xs font-medium gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 rounded cursor-pointer"
              title="Mahsulotni qutilarga taqsimlash va quti pasportlarini chop etish"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Qadoqlash (Quick Pack)</span>
              {packagesCount !== undefined && packagesCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono ml-0.5">
                  {packagesCount} quti
                </Badge>
              )}
            </Button>
          )}

          {onSyncFromPlan && (
            <Button
              onClick={onSyncFromPlan}
              variant="outline"
              size="sm"
              className="h-6.5 px-2 text-xs font-medium gap-1 text-primary border-primary/30 hover:bg-primary/10 rounded cursor-pointer"
              title="CTP va bosma hisobidan texnologik marshrutni yangilash"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Rejadan yangilash</span>
            </Button>
          )}

          {hasSelectedOp && (
            <>
              <Button
                onClick={() => onOpenEditOperation(selectedOpRow)}
                variant="outline"
                size="sm"
                className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer"
              >
                <ExternalLink className="w-3 h-3 text-amber-500" />
                <span>Tahrirlash</span>
              </Button>

              {onOpenInTimeline && (
                <Button
                  onClick={() => onOpenInTimeline(operations[selectedOpRow].id)}
                  variant="outline"
                  size="sm"
                  className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="Ushbu bosqichning sexdagi bajarilishi va smena hisobotini Timeline bo'limida ochish"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Bajarilish (Timeline)</span>
                </Button>
              )}

              <Button
                onClick={onDeleteSelectedOperation}
                variant="ghost"
                size="sm"
                className="h-6.5 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>O&apos;chirish</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {hasSelectedOp && (
            <>
              <span className="font-mono">
                Tanlangan: <strong className="text-foreground">#{operations[selectedOpRow].stepNumber}</strong> ({operations[selectedOpRow].machine})
              </span>
              <Separator orientation="vertical" className="h-3" />
            </>
          )}
          <span>Bosqichlar: <strong className="text-foreground">{operations.length} ta</strong></span>
          <Separator orientation="vertical" className="h-3" />
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Me&apos;yor: <strong className="text-foreground">{totalDuration} soat</strong>
          </span>
        </div>
      </div>

      {/* 2. Glide Data Grid */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className="flex-1 w-full h-full relative" 
            id="glide-wo-route-grid-root"
            onKeyDown={(e) => {
              if (e.key === "Insert") {
                e.preventDefault();
                onOpenAddOperation();
              } else if (e.key === "Delete" && hasSelectedOp) {
                e.preventDefault();
                onDeleteSelectedOperation();
              }
            }}
          >
            <DataEditor
              getCellContent={getOpCellContent}
              columns={opColumns}
              rows={operations.length}
              onCellEdited={onOpCellEdited}
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
                onOpenEditOperation(row);
              }}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={onOpenAddOperation} className="gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>Add Routing Step</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
          </ContextMenuItem>

          {hasSelectedOp && (
            <ContextMenuItem onClick={() => onOpenEditOperation(selectedOpRow)} className="gap-2 cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
              <span>Edit Step Plan</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
            </ContextMenuItem>
          )}

          {hasSelectedOp && onOpenInTimeline && (
            <ContextMenuItem
              onClick={() => onOpenInTimeline(operations[selectedOpRow].id)}
              className="gap-2 cursor-pointer text-blue-600 dark:text-blue-400"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Track Execution in Timeline</span>
            </ContextMenuItem>
          )}

          {hasSelectedOp && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onDeleteSelectedOperation} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Step</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </TabsContent>
  );
}
