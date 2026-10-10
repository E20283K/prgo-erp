"use client";

import React, { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  EditableGridCell,
  GridColumnIcon,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  User,
  Layers,
  Sparkles,
  CalendarDays,
} from "lucide-react";

import { useTaskStore, TaskItem, TaskStatus, TaskPriority, TaskRoleCategory } from "@/store/taskStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";

export function TaskGrid() {
  const t = useTranslations("Tasks");
  const tCommon = useTranslations("Common");
  const {
    tasks,
    filter,
    setFilter,
    resetFilter,
    selectTask,
    setCreateModalOpen,
    deleteTask,
    setTaskStatus,
  } = useTaskStore();

  const { theme, updateGridStats, currentUser } = useWorkspaceStore();
  const isDark = theme === "dark";

  // DataEditor ref & selection
  const gridRef = useRef<any>(null);
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Filter tasks according to state
  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      // Role filter
      if (filter.roleCategory === "my") {
        if (!item.assignedTo.toLowerCase().includes(currentUser.name.toLowerCase().split(" ")[0])) {
          return false;
        }
      } else if (filter.roleCategory !== "all") {
        if (item.roleCategory !== filter.roleCategory) return false;
      }

      // Status filter
      if (filter.status !== "all" && item.status !== filter.status) {
        return false;
      }

      // Priority filter
      if (filter.priority !== "all" && item.priority !== filter.priority) {
        return false;
      }

      // Search Query
      if (filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchAssignee = item.assignedTo.toLowerCase().includes(q);
        const matchRelated = (item.relatedId || "").toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchAssignee && !matchRelated) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filter, currentUser]);

  // Update status bar stats
  useEffect(() => {
    const selectedCount = gridSelection.rows.length;
    updateGridStats(selectedCount, filteredTasks.length);
  }, [gridSelection, filteredTasks.length, updateGridStats]);

  // Keyboard navigation: Ins -> new task, F12 -> open task, Del -> delete task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Insert") {
        e.preventDefault();
        setCreateModalOpen(true);
      } else if (e.key === "F12") {
        e.preventDefault();
        const selectedIndex = gridSelection.current?.cell[1];
        if (selectedIndex !== undefined && filteredTasks[selectedIndex]) {
          selectTask(filteredTasks[selectedIndex].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridSelection, filteredTasks, setCreateModalOpen, selectTask]);

  // Grid columns definition
  const columns: GridColumn[] = useMemo(() => [
    { id: "id", title: t("colId"), width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "title", title: t("colTitle"), width: 340, icon: GridColumnIcon.HeaderString },
    { id: "roleCategory", title: t("colCategory"), width: 130, icon: GridColumnIcon.HeaderLookup },
    { id: "priority", title: t("colPriority"), width: 110, icon: GridColumnIcon.HeaderSingleValue },
    { id: "status", title: t("colStatus"), width: 130, icon: GridColumnIcon.HeaderSingleValue },
    { id: "assignedTo", title: t("colAssignee"), width: 180, icon: GridColumnIcon.HeaderString },
    { id: "dueDate", title: t("colDueDate"), width: 140, icon: GridColumnIcon.HeaderDate },
    { id: "relatedId", title: t("colLinked"), width: 140, icon: GridColumnIcon.HeaderReference },
    { id: "checklist", title: t("colChecklist"), width: 100, icon: GridColumnIcon.HeaderNumber },
  ], [t]);

  // Column resize handling
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const handleColumnResize = useCallback((col: GridColumn, newSize: number) => {
    setColumnWidths((prev) => ({ ...prev, [col.id as string]: newSize }));
  }, []);

  const dynamicColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      width: columnWidths[col.id as string] || (col as any).width || 120,
    }));
  }, [columns, columnWidths]);

  // Get Cell Content
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = filteredTasks[rowIndex];
      if (!row) {
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: "",
          displayData: "",
        };
      }

      const col = dynamicColumns[colIndex];
      const colId = col?.id as keyof TaskItem | "checklist";

      if (colId === "id") {
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: row.id,
          displayData: row.id,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (colId === "title") {
        return {
          kind: GridCellKind.Text,
          allowOverlay: true,
          data: row.title,
          displayData: row.title,
        };
      }

      if (colId === "roleCategory") {
        const catMap: Record<TaskRoleCategory, string> = {
          operator: t("operatorTasks"),
          manager: t("managerTasks"),
          general: t("generalTasks"),
          system: t("systemTasks"),
        };
        const label = catMap[row.roleCategory] || row.roleCategory;
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: label,
          displayData: label,
        };
      }

      if (colId === "priority") {
        const pMap: Record<TaskPriority, string> = {
          urgent: t("priorityUrgent"),
          high: t("priorityHigh"),
          normal: t("priorityNormal"),
          low: t("priorityLow"),
        };
        const label = pMap[row.priority] || row.priority;
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: label,
          displayData: label,
          themeOverride: row.priority === "urgent" ? {
            textDark: "#ef4444",
            baseFontStyle: "bold 12px sans-serif",
          } : row.priority === "high" ? {
            textDark: "#f59e0b",
          } : undefined,
        };
      }

      if (colId === "status") {
        const sMap: Record<TaskStatus, string> = {
          pending: t("statusPending"),
          "in-progress": t("statusInProgress"),
          blocked: t("statusBlocked"),
          completed: t("statusCompleted"),
          cancelled: t("statusCancelled"),
        };
        const label = sMap[row.status] || row.status;
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: label,
          displayData: label,
          themeOverride: row.status === "completed" ? {
            textDark: "#10b981",
          } : row.status === "blocked" ? {
            textDark: "#ef4444",
            baseFontStyle: "bold 12px sans-serif",
          } : row.status === "in-progress" ? {
            textDark: isDark ? "#60a5fa" : "#2563eb",
          } : undefined,
        };
      }

      if (colId === "assignedTo") {
        return {
          kind: GridCellKind.Text,
          allowOverlay: true,
          data: row.assignedTo,
          displayData: row.assignedTo,
        };
      }

      if (colId === "dueDate") {
        return {
          kind: GridCellKind.Text,
          allowOverlay: true,
          data: row.dueDate,
          displayData: row.dueDate,
        };
      }

      if (colId === "relatedId") {
        const rel = row.relatedId ? `${row.relatedId}` : "—";
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: rel,
          displayData: rel,
          themeOverride: row.relatedId ? {
            textDark: isDark ? "#93c5fd" : "#1d4ed8",
            baseFontStyle: "12px monospace",
          } : undefined,
        };
      }

      if (colId === "checklist") {
        const completed = row.checklist.filter((c) => c.completed).length;
        const total = row.checklist.length;
        const disp = total > 0 ? `${completed}/${total}` : "—";
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          data: disp,
          displayData: disp,
          themeOverride: {
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        data: "",
        displayData: "",
      };
    },
    [filteredTasks, dynamicColumns, isDark, t]
  );

  // Cell activated (double click or enter)
  const onCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const target = filteredTasks[rowIndex];
      if (target) {
        selectTask(target.id);
      }
    },
    [filteredTasks, selectTask]
  );

  // Inline Cell Edited
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [colIndex, rowIndex] = cell;
      const target = filteredTasks[rowIndex];
      if (!target) return;

      const col = dynamicColumns[colIndex];
      const colId = col?.id;

      if (colId === "title" && newValue.kind === GridCellKind.Text) {
        useTaskStore.getState().updateTask(target.id, { title: newValue.data });
      } else if (colId === "assignedTo" && newValue.kind === GridCellKind.Text) {
        useTaskStore.getState().updateTask(target.id, { assignedTo: newValue.data });
      } else if (colId === "dueDate" && newValue.kind === GridCellKind.Text) {
        useTaskStore.getState().updateTask(target.id, { dueDate: newValue.data });
      }
    },
    [filteredTasks, dynamicColumns]
  );

  // Stats calculation
  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === "pending" || t.status === "in-progress").length;
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.status !== "completed").length;
  const myCount = tasks.filter((t) => t.assignedTo.toLowerCase().includes(currentUser.name.toLowerCase().split(" ")[0])).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden">
      {/* Dialogs */}
      <TaskDetailDialog />
      <CreateTaskModal />

      {/* ── Top Bar: High Density 1C Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/80 gap-2 flex-wrap">
        {/* Left: Quick Role Presets & Title */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-7 text-xs px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1 shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>{t("newTask")}</span>
            <span className="text-[10px] opacity-70 ml-0.5 font-mono">Ins</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Preset Buttons */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60">
            <button
              onClick={() => setFilter({ roleCategory: "all" })}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                filter.roleCategory === "all"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("allTasks")}
            </button>
            <button
              onClick={() => setFilter({ roleCategory: "my" })}
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                filter.roleCategory === "my"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="size-3 text-primary" />
              <span>{t("myTasks")}</span>
              {myCount > 0 && (
                <span className="px-1 text-[10px] bg-primary/10 text-primary rounded-full font-mono">
                  {myCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter({ roleCategory: "operator" })}
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                filter.roleCategory === "operator"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PlayCircle className="size-3 text-sky-500" />
              <span>{t("operatorTasks")}</span>
            </button>
            <button
              onClick={() => setFilter({ roleCategory: "manager" })}
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                filter.roleCategory === "manager"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-3 text-purple-500" />
              <span>{t("managerTasks")}</span>
            </button>
            <button
              onClick={() => setFilter({ roleCategory: "general" })}
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                filter.roleCategory === "general"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="size-3 text-emerald-500" />
              <span>{t("generalTasks")}</span>
            </button>
          </div>
        </div>

        {/* Right: Search, Status filter, View Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={filter.searchQuery}
              onChange={(e) => setFilter({ searchQuery: e.target.value })}
              placeholder={t("searchPlaceholder")}
              className="h-7 text-xs pl-7 pr-2 bg-background border-border"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={filter.status}
            onChange={(e) => setFilter({ status: e.target.value as any })}
            className="h-7 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">{t("statusAll")}</option>
            <option value="pending">{t("statusPending")}</option>
            <option value="in-progress">{t("statusInProgress")}</option>
            <option value="blocked">{t("statusBlocked")}</option>
            <option value="completed">{t("statusCompleted")}</option>
          </select>

          {/* View mode toggle: Table vs Kanban vs Calendar */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60">
            <button
              title={t("viewGrid")}
              onClick={() => setFilter({ viewMode: "grid" })}
              className={`p-1 rounded transition-colors ${
                filter.viewMode === "grid"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="size-3.5" />
            </button>
            <button
              title={t("viewBoard")}
              onClick={() => setFilter({ viewMode: "board" })}
              className={`p-1 rounded transition-colors ${
                filter.viewMode === "board"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              title={t("viewCalendar")}
              onClick={() => setFilter({ viewMode: "calendar" })}
              className={`p-1 rounded transition-colors ${
                filter.viewMode === "calendar"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub Header: KPI Stats Strip ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-muted/30 border-b border-border/60 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="font-semibold text-foreground font-mono">{filteredTasks.length}</span>
            <span>/ {totalCount} {t("statsTotal")}</span>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Clock className="size-3" />
            <span className="font-semibold font-mono">{pendingCount}</span>
            <span>{t("statsPending")}</span>
          </span>
          {urgentCount > 0 && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                <AlertTriangle className="size-3" />
                <span className="font-mono">{urgentCount}</span>
                <span>{t("statsUrgent")}</span>
              </span>
            </>
          )}
          <Separator orientation="vertical" className="h-3" />
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            <span className="font-semibold font-mono">{completedCount}</span>
            <span>{t("statsCompleted")}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-muted-foreground/80">
            Enter / Double-Click: {t("openTask")}
          </span>
        </div>
      </div>

      {/* ── View Container: Grid, Kanban, or Calendar ── */}
      <div className="flex-1 w-full relative min-h-0 overflow-hidden">
        {filter.viewMode === "calendar" ? (
          <TaskCalendarView tasks={filteredTasks} />
        ) : filter.viewMode === "board" ? (
          <TaskKanbanBoard tasks={filteredTasks} />
        ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="w-full h-full">
                <DataEditor
                  ref={gridRef}
                  width="100%"
                  height="100%"
                  columns={dynamicColumns}
                  rows={filteredTasks.length}
                  getCellContent={getCellContent}
                  onCellActivated={onCellActivated}
                  onCellEdited={onCellEdited}
                  onColumnResize={handleColumnResize}
                  gridSelection={gridSelection}
                  onGridSelectionChange={setGridSelection}
                  freezeColumns={1}
                  rowMarkers="both"
                  rowHeight={28}
                  headerHeight={30}
                  smoothScrollX
                  smoothScrollY
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                />
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="text-xs">
              <ContextMenuItem
                onClick={() => {
                  const selRow = gridSelection.current?.cell[1];
                  if (selRow !== undefined && filteredTasks[selRow]) {
                    selectTask(filteredTasks[selRow].id);
                  }
                }}
              >
                <ExternalLink className="size-3.5 mr-2" />
                {t("openTask")}
              </ContextMenuItem>

              <ContextMenuItem onClick={() => setCreateModalOpen(true)}>
                <Plus className="size-3.5 mr-2" />
                {t("newTask")}
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Clock className="size-3.5 mr-2" />
                  {t("fieldStatus")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="text-xs">
                  <ContextMenuItem
                    onClick={() => {
                      const selRow = gridSelection.current?.cell[1];
                      if (selRow !== undefined && filteredTasks[selRow]) {
                        setTaskStatus(filteredTasks[selRow].id, "pending");
                      }
                    }}
                  >
                    {t("statusPending")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const selRow = gridSelection.current?.cell[1];
                      if (selRow !== undefined && filteredTasks[selRow]) {
                        setTaskStatus(filteredTasks[selRow].id, "in-progress");
                      }
                    }}
                  >
                    {t("statusInProgress")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const selRow = gridSelection.current?.cell[1];
                      if (selRow !== undefined && filteredTasks[selRow]) {
                        setTaskStatus(filteredTasks[selRow].id, "completed");
                      }
                    }}
                  >
                    {t("statusCompleted")}
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSeparator />

              <ContextMenuItem
                className="text-destructive"
                onClick={() => {
                  const selRow = gridSelection.current?.cell[1];
                  if (selRow !== undefined && filteredTasks[selRow]) {
                    deleteTask(filteredTasks[selRow].id);
                  }
                }}
              >
                <Trash2 className="size-3.5 mr-2" />
                {t("deleteTask")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
      </div>
    </div>
  );
}
