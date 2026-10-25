"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Gantt, Willow, Tooltip, IApi, ITask, IZoomConfig } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import "./svar-gantt.css";
import {
  format,
  addDays,
  isToday,
  differenceInCalendarDays,
  Locale,
} from "date-fns";
import { enUS, ru, uz, tr } from "date-fns/locale";
import { ZoomIn, ZoomOut, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { OrderRow } from "./DataGrid";
import { openWorkOrderTab } from "./openWorkOrderTab";

export interface WorkOrderTimelineViewProps {
  orders: OrderRow[];
  onOpenOrder?: (order: OrderRow) => void;
  onCreateNew?: () => void;
  currentDate?: Date;
  onDateChange?: (d: Date) => void;
  mode?: "month" | "week" | "day";
  onModeChange?: (mode: "month" | "week" | "day") => void;
}

interface WoTask extends ITask {
  id: string;
  text: string;
  customer: string;
  start: Date;
  end?: Date;
  type: "task" | "milestone";
  status: OrderRow["status"];
  overdue: boolean;
  dashed: boolean;
  noStart: boolean;
  order: OrderRow;
}

const LOCALE_MAP: Record<string, Locale> = {
  en: enUS,
  ru,
  uz,
  tr,
};

const STATUS_BAR: Record<OrderRow["status"], string> = {
  Draft: "bg-muted-foreground/40 text-foreground",
  Active: "bg-blue-500/80 text-white",
  Completed: "bg-emerald-500/80 text-white",
  Cancelled: "bg-red-500/50 text-white",
};

function parseOrderDate(raw: string | undefined, isEnd: boolean): Date | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const hasTime = trimmed.includes(" ") || trimmed.includes("T");
  const normalized = trimmed.replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) {
    if (!hasTime) {
      if (isEnd) {
        d.setHours(23, 59, 59, 999);
      } else {
        d.setHours(0, 0, 0, 0);
      }
    }
    return d;
  }
  return null;
}

function WoBar({ data }: { data: ITask }) {
  const task = data as WoTask;
  if (task.type === "milestone") {
    return (
      <div className="px-1.5 text-[10px] font-mono text-foreground whitespace-nowrap">
        {task.text}
      </div>
    );
  }

  const baseColor = task.dashed
    ? "border border-dashed border-foreground/50 bg-muted/40 text-foreground"
    : STATUS_BAR[task.status] || STATUS_BAR.Draft;
  const overdueRing = task.overdue ? "ring-1 ring-destructive" : "";

  return (
    <div
      className={`w-full h-full flex items-center px-1.5 rounded-xs text-[10px] font-mono leading-none truncate select-none ${baseColor} ${overdueRing}`}
    >
      <span className="truncate">{task.text}</span>
    </div>
  );
}

export function WorkOrderTimelineView({
  orders,
  onOpenOrder,
  onCreateNew,
}: WorkOrderTimelineViewProps) {
  const tTasks = useTranslations("Tasks");
  const tGrid = useTranslations("DataGrid");
  const tCommon = useTranslations("Common");
  const t = useTranslations("WorkOrderTimeline");
  const localeCode = useLocale();
  const dfLocale = LOCALE_MAP[localeCode] || enUS;
  const { openTab } = useWorkspaceStore();

  const [api, setApi] = useState<IApi | undefined>(undefined);
  const [activeZoomIdx, setActiveZoomIdx] = useState<number>(2);
  const [isPanning, setIsPanning] = useState(false);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const suppressSelectRef = useRef(false);
  const panStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    chartEl: HTMLElement | null;
    ganttEl: HTMLElement | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    chartEl: null,
    ganttEl: null,
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const st = panStateRef.current;
      if (!st.active) return;

      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;

      if (!st.moved && Math.hypot(dx, dy) > 4) {
        st.moved = true;
        suppressSelectRef.current = true;
        setIsPanning(true);
      }

      if (st.moved) {
        e.preventDefault();
        if (st.chartEl) {
          st.chartEl.scrollLeft = Math.max(0, st.startLeft - dx);
        }
        if (st.ganttEl) {
          st.ganttEl.scrollTop = Math.max(0, st.startTop - dy);
        }
      }
    };

    const handleMouseUp = () => {
      const st = panStateRef.current;
      if (!st.active) return;
      const wasMoved = st.moved;
      st.active = false;
      st.moved = false;
      st.chartEl = null;
      st.ganttEl = null;
      setIsPanning(false);

      if (wasMoved) {
        window.setTimeout(() => {
          suppressSelectRef.current = false;
        }, 60);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Allow left-click (0) or middle-click (1) drag-to-pan on the chart area
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Do not hijack column resizers or left-table clicks unless middle-click is used
    if (target.closest(".wx-resizer")) return;
    if (e.button === 0 && target.closest(".wx-table-container")) return;

    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const chartEl = wrap.querySelector<HTMLElement>(".wx-chart");
    const ganttEl = wrap.querySelector<HTMLElement>(".wx-gantt");
    if (!chartEl && !ganttEl) return;

    if (e.button === 1) {
      e.preventDefault();
    }

    panStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: chartEl?.scrollLeft ?? 0,
      startTop: ganttEl?.scrollTop ?? 0,
      chartEl,
      ganttEl,
    };
  }, []);

  const zoomConfig = useMemo<IZoomConfig>(() => {
    return {
      level: activeZoomIdx,
      levels: [
        {
          minCellWidth: 80,
          maxCellWidth: 260,
          scales: [
            {
              unit: "year",
              step: 1,
              format: (d: Date) => format(d, "yyyy", { locale: dfLocale }),
            },
            {
              unit: "month",
              step: 1,
              format: (d: Date) => format(d, "LLL", { locale: dfLocale }),
            },
          ],
        },
        {
          minCellWidth: 90,
          maxCellWidth: 280,
          scales: [
            {
              unit: "month",
              step: 1,
              format: (d: Date) => format(d, "LLLL yyyy", { locale: dfLocale }),
            },
            {
              unit: "week",
              step: 1,
              format: (d: Date) => format(d, "d MMM", { locale: dfLocale }),
            },
          ],
        },
        {
          minCellWidth: 28,
          maxCellWidth: 160,
          scales: [
            {
              unit: "month",
              step: 1,
              format: (d: Date) => format(d, "LLLL yyyy", { locale: dfLocale }),
            },
            {
              unit: "day",
              step: 1,
              format: (d: Date) => format(d, "d EEE", { locale: dfLocale }),
            },
          ],
        },
        {
          minCellWidth: 36,
          maxCellWidth: 120,
          scales: [
            {
              unit: "day",
              step: 1,
              format: (d: Date) => format(d, "EEEE, d MMM yyyy", { locale: dfLocale }),
            },
            {
              unit: "hour",
              step: 1,
              format: (d: Date) => format(d, "HH:mm", { locale: dfLocale }),
            },
          ],
        },
      ],
    };
  }, [dfLocale, activeZoomIdx]);

  const tasks = useMemo<WoTask[]>(() => {
    const now = new Date();
    const list: WoTask[] = [];

    for (const order of orders) {
      const s = parseOrderDate(order.startDate, false);
      const e = parseOrderDate(order.deadline, true);
      if (!s && !e) continue;

      let start: Date;
      let end: Date;
      let type: "task" | "milestone" = "task";
      let dashed = false;
      let noStart = false;

      if (!s && e) {
        start = e;
        end = e;
        type = "milestone";
        noStart = true;
      } else if (s && !e) {
        start = s;
        end = addDays(s, 1);
        dashed = true;
      } else {
        start = s!;
        end = e! >= s! ? e! : addDays(s!, 1);
      }

      const overdue =
        !!e &&
        e < now &&
        order.status !== "Completed" &&
        order.status !== "Cancelled";

      list.push({
        id: order.id,
        text: order.id,
        customer: order.customer,
        start,
        end,
        type,
        status: order.status,
        overdue,
        dashed,
        noStart,
        order,
      });
    }

    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    return list;
  }, [orders]);

  const ordersById = useMemo(() => {
    const map = new Map<string, OrderRow>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const handleOpenById = useCallback(
    (id: string | number) => {
      const found = ordersById.get(String(id));
      if (!found) return;
      if (onOpenOrder) onOpenOrder(found);
      else openWorkOrderTab(found, openTab);
    },
    [ordersById, onOpenOrder, openTab]
  );

  const handleInit = useCallback(
    (ganttApi: IApi) => {
      setApi(ganttApi);
      ganttApi.on("select-task", (ev: { id: string | number }) => {
        if (suppressSelectRef.current) return;
        if (ev?.id != null) handleOpenById(ev.id);
      });
    },
    [handleOpenById]
  );

  const handleZoomStep = (dir: 1 | -1) => {
    if (!api) return;
    api.exec("zoom-scale", { dir, ratio: 0.25, offset: 240 });
  };

  const handleSelectZoomPreset = (levelIndex: number) => {
    setActiveZoomIdx(levelIndex);
  };

  const handleScrollToday = () => {
    if (!api) return;
    const anchor = tasks[0]?.start || new Date();
    const today = new Date();
    const state = api.getState?.();
    const start: Date | undefined = state?._start;
    const end: Date | undefined = state?._end;
    const target =
      start && end && today >= start && today <= end ? today : anchor;
    api.exec("scroll-chart", { date: target });
  };

  const columns = useMemo(
    () => [
      { id: "text", header: t("order"), width: 115 },
      { id: "customer", header: t("customer"), width: 165 },
    ],
    [t]
  );

  const highlightTime = useCallback((date: Date, unit: "day" | "hour") => {
    if (isToday(date)) return "wx-today";
    if (unit === "day") {
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return "wx-weekend";
    }
    return "";
  }, []);

  const TooltipContent = useCallback(
    ({ data }: { api: IApi; data: Record<string, unknown> }) => {
      const task = data?.task as WoTask | undefined;
      if (!task?.order) return null;
      const o = task.order;
      const days =
        task.end && task.start
          ? Math.max(1, differenceInCalendarDays(task.end, task.start))
          : 1;

      const statusLabel =
        o.status === "Active"
          ? tCommon("statusActive")
          : o.status === "Completed"
          ? tCommon("statusCompleted")
          : o.status === "Cancelled"
          ? tCommon("statusCancelled")
          : tCommon("statusDraft");

      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-md p-2 text-xs shadow-xs min-w-[220px] max-w-[280px] space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
            <span className="font-mono font-semibold">{o.id}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{statusLabel}</span>
          </div>
          <div className="font-medium text-foreground truncate">{o.product}</div>
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-0.5">
            <div>
              <span className="text-foreground/80">{t("customer")}:</span> {o.customer}
            </div>
            <div>
              <span className="text-foreground/80">{t("machine")}:</span> {o.machine}
            </div>
            <div>
              <span className="text-foreground/80">{t("start")}:</span>{" "}
              {task.noStart ? t("noStart") : o.startDate}
            </div>
            <div>
              <span className="text-foreground/80">{t("deadline")}:</span>{" "}
              {task.dashed ? t("noDeadline") : o.deadline}
            </div>
            {!task.noStart && !task.dashed && (
              <div>
                <span className="text-foreground/80">{t("duration")}:</span> {days}d
              </div>
            )}
            {task.overdue && (
              <div className="text-destructive font-medium">{t("overdue")}</div>
            )}
          </div>
        </div>
      );
    },
    [t, tCommon]
  );

  return (
    <div className="wo-timeline flex flex-col h-full w-full bg-background select-none overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 h-9 border-b border-border bg-card/60">
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md bg-background overflow-hidden">
            <Button
              variant="ghost"
              size="icon-xs"
              title={t("zoomOut")}
              onClick={() => handleZoomStep(-1)}
              className="h-7 w-7 rounded-none border-r border-border hover:bg-muted"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleScrollToday}
              className="h-7 px-2.5 rounded-none font-medium text-xs hover:bg-muted"
            >
              {tTasks("today")}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              title={t("zoomIn")}
              onClick={() => handleZoomStep(1)}
              className="h-7 w-7 rounded-none border-l border-border hover:bg-muted"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </div>

          <span className="text-[11px] font-mono text-muted-foreground ml-1">
            {t("zoomHint")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60">
            <button
              onClick={() => handleSelectZoomPreset(0)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                activeZoomIdx === 0
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tTasks("month")}
            </button>
            <button
              onClick={() => handleSelectZoomPreset(1)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                activeZoomIdx === 1
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tTasks("week")}
            </button>
            <button
              onClick={() => handleSelectZoomPreset(2)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                activeZoomIdx === 2
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tTasks("day")}
            </button>
          </div>

          {onCreateNew && (
            <Button
              size="xs"
              onClick={onCreateNew}
              className="h-7 text-xs font-medium gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              <span>{tGrid("createNew")}</span>
            </Button>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div
          ref={canvasWrapRef}
          onMouseDown={handleCanvasMouseDown}
          className={`flex-1 min-h-0 w-full overflow-hidden ${
            isPanning ? "wo-timeline-panning" : ""
          }`}
        >
          <Willow fonts={false}>
            <Tooltip api={api} content={TooltipContent}>
              <Gantt
                key={`zoom-${activeZoomIdx}`}
                init={handleInit}
                tasks={tasks}
                links={[]}
                readonly
                columns={columns}
                zoom={zoomConfig}
                autoScale={true}
                cellWidth={52}
                cellHeight={28}
                scaleHeight={26}
                taskTemplate={WoBar}
                highlightTime={highlightTime}
              />
            </Tooltip>
          </Willow>
        </div>
      )}
    </div>
  );
}
export default WorkOrderTimelineView;
