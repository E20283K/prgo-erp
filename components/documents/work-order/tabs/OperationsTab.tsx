"use client";

import React, { useMemo, useCallback } from "react";
import { Plus, ExternalLink, CheckCircle2, Trash2, Layers, Clock, ChevronRight } from "lucide-react";
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

interface OperationsTabProps {
  operations: RouteStep[];
  setOperations: React.Dispatch<React.SetStateAction<RouteStep[]>>;
  opSelection: GridSelection;
  setOpSelection: React.Dispatch<React.SetStateAction<GridSelection>>;
  onOpenAddOperation: () => void;
  onOpenEditOperation: (index: number) => void;
  onDeleteSelectedOperation: () => void;
  isDark: boolean;
  onMarkUnsaved: () => void;
}

export function OperationsTab({
  operations,
  setOperations,
  opSelection,
  setOpSelection,
  onOpenAddOperation,
  onOpenEditOperation,
  onDeleteSelectedOperation,
  isDark,
  onMarkUnsaved,
}: OperationsTabProps) {
  const selectedOpRow = opSelection.rows.first();
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  const totalDuration = useMemo(() => {
    return operations.reduce((sum, op) => sum + (Number(op.duration) || 0), 0);
  }, [operations]);

  const finishedCount = useMemo(() => {
    return operations.filter((op) => op.status === "Finished").length;
  }, [operations]);

  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "step", title: "Step", width: 65, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Texnologik Operatsiya (Description)", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "machine", title: "Stanok / Uskuna (Work Center)", width: 230, icon: GridColumnIcon.HeaderLookup },
    { id: "operator", title: "Operator / Smena", width: 150, icon: GridColumnIcon.HeaderString },
    { id: "duration", title: "Davomiyligi (hrs)", width: 120, icon: GridColumnIcon.HeaderNumber },
    { id: "progress", title: "Bajarildi (Qty)", width: 140, icon: GridColumnIcon.HeaderString },
    { id: "status", title: "Status", width: 130, icon: GridColumnIcon.HeaderSingleValue },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: op.stepNumber, displayData: `#${op.stepNumber}`, allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: op.machine, displayData: op.machine, allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: op.operator || "Unassigned", displayData: op.operator || "Unassigned", allowOverlay: true };
    if (col === 4) return { kind: GridCellKind.Number, data: op.duration || 1, displayData: `${op.duration || 1} soat`, allowOverlay: true };
    if (col === 5) return { kind: GridCellKind.Text, data: op.qtyCompleted || "0 / 0", displayData: op.qtyCompleted || "0 / 0", allowOverlay: true };
    if (col === 6) {
      const statusColor = op.status === "Finished" 
        ? (isDark ? "#4ade80" : "#15803d") 
        : op.status === "In Progress" 
        ? (isDark ? "#60a5fa" : "#2563eb") 
        : (isDark ? "#9ca3af" : "#64748b");
      return {
        kind: GridCellKind.Text,
        data: op.status,
        displayData: op.status,
        allowOverlay: false,
        themeOverride: {
          textDark: statusColor,
          baseFontStyle: "600 12px sans-serif",
        }
      };
    }

    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [operations, isDark]);

  const onOpCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const updated = [...operations];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      updated[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      updated[row].machine = newValue.data.toString();
    } else if (col === 3 && newValue.kind === GridCellKind.Text) {
      updated[row].operator = newValue.data.toString();
    } else if (col === 4 && newValue.kind === GridCellKind.Number) {
      updated[row].duration = Number(newValue.data);
    } else if (col === 5 && newValue.kind === GridCellKind.Text) {
      updated[row].qtyCompleted = newValue.data.toString();
    }
    setOperations(updated);
    onMarkUnsaved();
  }, [operations, setOperations, onMarkUnsaved]);

  const handleToggleStatus = () => {
    if (!hasSelectedOp) return;
    const updated = [...operations];
    updated[selectedOpRow].status = updated[selectedOpRow].status === "Finished" ? "In Progress" : "Finished";
    setOperations(updated);
    onMarkUnsaved();
  };

  return (
    <TabsContent value="operations" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background select-none">
      {/* 1. Visual Route Pipeline Bar */}
      <div className="h-11 border-b border-border bg-muted/30 px-3 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">Marshrut Zanjiri:</span>
        </span>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto py-1">
          {operations.map((op, idx) => {
            const isFinished = op.status === "Finished";
            const isInProgress = op.status === "In Progress";
            const isSelected = selectedOpRow === idx;

            return (
              <React.Fragment key={op.id || idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                <button
                  type="button"
                  onClick={() => {
                    setOpSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(idx),
                    });
                  }}
                  className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer border transition-all shrink-0 ${
                    isSelected
                      ? "ring-2 ring-blue-500/50 border-blue-500 font-semibold shadow-xs"
                      : ""
                  } ${
                    isFinished
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium"
                      : isInProgress
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${op.name} (${op.machine})`}
                >
                  <span className="text-[10px] font-mono opacity-70">#{op.stepNumber}</span>
                  <span className="truncate max-w-[130px]">{op.name.split(" ")[0]} {op.name.split(" ")[1] || ""}</span>
                  {isFinished && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                  {isInProgress && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Stats Pill */}
        <div className="hidden md:flex items-center gap-2 ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground border-l border-border">
          <span>Bosqichlar: <strong className="text-foreground">{finishedCount}/{operations.length}</strong></span>
          <Separator orientation="vertical" className="h-3" />
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> <strong className="text-foreground">{totalDuration} soat</strong></span>
        </div>
      </div>

      {/* 2. Operations Toolbar */}
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

              <Button
                onClick={handleToggleStatus}
                variant="outline"
                size="sm"
                className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>{operations[selectedOpRow].status === "Finished" ? "Jarayonga qaytarish" : "Bajarildi qilish"}</span>
              </Button>

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

        <div className="text-[11px] text-muted-foreground font-mono">
          {hasSelectedOp ? `Tanlangan: #${operations[selectedOpRow].stepNumber} (${operations[selectedOpRow].machine})` : `${operations.length} ta marshrut bosqichi`}
        </div>
      </div>

      {/* 3. Glide Data Grid */}
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
              <span>Edit Step Details</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
            </ContextMenuItem>
          )}

          {hasSelectedOp && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={handleToggleStatus} 
                className="gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Toggle Finished Status</span>
              </ContextMenuItem>
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
