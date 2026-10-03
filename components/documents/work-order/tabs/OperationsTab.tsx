"use client";

import React, { useMemo, useCallback } from "react";
import { Plus, ExternalLink, CheckCircle2, Trash2 } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
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

  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "step", title: "Step", width: 65, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Operation Description", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "machine", title: "Machine / Work Center", width: 230, icon: GridColumnIcon.HeaderLookup },
    { id: "operator", title: "Operator", width: 140, icon: GridColumnIcon.HeaderString },
    { id: "duration", title: "Duration (hrs)", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "progress", title: "Progress (Qty)", width: 130, icon: GridColumnIcon.HeaderString },
    { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: op.stepNumber, displayData: String(op.stepNumber), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: op.machine, displayData: op.machine, allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: op.operator || "Unassigned", displayData: op.operator || "Unassigned", allowOverlay: true };
    if (col === 4) return { kind: GridCellKind.Number, data: op.duration || 1, displayData: `${op.duration || 1}h`, allowOverlay: true };
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
    }
    setOperations(updated);
    onMarkUnsaved();
  }, [operations, setOperations, onMarkUnsaved]);

  return (
    <TabsContent value="operations" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
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
                onClick={() => {
                  const updated = [...operations];
                  updated[selectedOpRow].status = updated[selectedOpRow].status === "Finished" ? "In Progress" : "Finished";
                  setOperations(updated);
                  onMarkUnsaved();
                }} 
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
