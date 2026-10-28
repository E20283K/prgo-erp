"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Gantt, Willow, IApi, ITask, IZoomConfig, IMarker } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import "./svar-gantt.css";
import {
  format,
  addDays,
  addHours,
  isToday,
  differenceInCalendarDays,
  differenceInHours,
  Locale,
} from "date-fns";
import { enUS, ru, uz, tr } from "date-fns/locale";
import {
  ZoomIn,
  ZoomOut,
  Plus,
  Image as ImageIcon,
  ArrowUpDown,
} from "lucide-react";
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

type DeltaState = "early" | "ontime" | "late" | "risk" | "left" | "none";
type SortField = "deadline" | "received" | "start";

interface BarSegment {
  left: number;
  width: number;
}

interface WoTask extends ITask {
  id: string;
  text: string;
  customer: string;
  deltaText: string;
  deltaState: DeltaState;
  start: Date;
  end: Date;
  type: "task";
  status: OrderRow["status"];
  overdue: boolean;
  atRisk: boolean;
  receivedAt: Date | null;
  startedAt: Date | null;
  deadlineAt: Date | null;
  completedAt: Date | null;
  waitDays: number | null;
  workDays: number | null;
  deltaDays: number | null;
  waitSeg: BarSegment | null;
  workSeg: BarSegment | null;
  overdueSeg: BarSegment | null;
  bufferSeg: (BarSegment & { kind: "saved" | "planned" }) | null;
  receivedPct: number | null;
  startPct: number | null;
  deadlinePct: number | null;
  completedPct: number | null;
  order: OrderRow;
}

const LOCALE_MAP: Record<string, Locale> = {
  en: enUS,
  ru,
  uz,
  tr,
};

function parseOrderDate(raw: string | undefined, mode: "start" | "end"): Date | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const hasTime = trimmed.includes(" ") || trimmed.includes("T");
  const normalized = trimmed.replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) {
    if (!hasTime) {
      if (mode === "end") {
        d.setHours(23, 59, 59, 999);
      } else {
        d.setHours(0, 0, 0, 0);
      }
    }
    return d;
  }
  return null;
}

function formatShortDate(d: Date | null, rawFallback: string | undefined, locale: Locale): string {
  if (d) {
    return format(d, "dd.MM.yyyy", { locale });
  }
  if (rawFallback && rawFallback.trim()) return rawFallback.trim();
  return "—";
}

function WoBar({ data }: { data: ITask }) {
  const task = data as WoTask;

  const isCompleted = task.status === "Completed" || Boolean(task.completedAt);
  const isCancelled = task.status === "Cancelled";

  const workTone = isCancelled
    ? "bg-zinc-500/60 text-white"
    : isCompleted
    ? "bg-emerald-600/85 dark:bg-emerald-500/80 text-white"
    : task.atRisk
    ? "bg-amber-500/85 text-white"
    : "bg-blue-600/85 dark:bg-blue-500/80 text-white";

  const deltaBadgeTone =
    task.deltaState === "late"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40"
      : task.deltaState === "early" || task.deltaState === "ontime"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
      : task.deltaState === "risk"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div
      data-wo-id={task.id}
      className="relative w-full h-full flex items-center select-none overflow-visible"
    >
      {/* 1. Queue / Wait segment (Received -> Started) */}
      {task.waitSeg && task.waitSeg.width > 0.2 && (
        <div
          style={{
            left: `${task.waitSeg.left}%`,
            width: `${task.waitSeg.width}%`,
          }}
          className="absolute h-2.5 top-1/2 -translate-y-1/2 bg-muted/80 dark:bg-muted/50 border border-dashed border-muted-foreground/45 rounded-l-xs pointer-events-none"
        />
      )}

      {/* 2. Active / Completed on-time production segment */}
      {task.workSeg && task.workSeg.width > 0.2 && (
        <div
          style={{
            left: `${task.workSeg.left}%`,
            width: `${task.workSeg.width}%`,
          }}
          className={`absolute inset-y-0.5 rounded-xs ${workTone} pointer-events-none`}
        />
      )}

      {/* 3. Planned remaining window or early-completion saved buffer */}
      {task.bufferSeg && task.bufferSeg.width > 0.2 && (
        <div
          style={{
            left: `${task.bufferSeg.left}%`,
            width: `${task.bufferSeg.width}%`,
          }}
          className={
            task.bufferSeg.kind === "saved"
              ? "absolute inset-y-1 bg-emerald-500/15 border border-dashed border-emerald-500/50 rounded-r-xs pointer-events-none"
              : "absolute inset-y-1 bg-blue-500/10 dark:bg-blue-400/10 border border-dashed border-blue-500/35 rounded-r-xs pointer-events-none"
          }
        />
      )}

      {/* 4. Overdue / Delay tail segment (past Deadline) */}
      {task.overdueSeg && task.overdueSeg.width > 0.2 && (
        <div
          style={{
            left: `${task.overdueSeg.left}%`,
            width: `${task.overdueSeg.width}%`,
          }}
          className="wo-segment-overdue absolute inset-y-0.5 bg-rose-600/90 dark:bg-rose-500/85 text-white rounded-r-xs ring-1 ring-rose-500/60 pointer-events-none"
        />
      )}

      {/* Fallback outline if all segments are tiny (same-day point order) */}
      {!task.waitSeg && !task.workSeg && !task.overdueSeg && !task.bufferSeg && (
        <div
          className={`absolute inset-y-0.5 inset-x-0 rounded-xs ${workTone} pointer-events-none`}
        />
      )}

      {/* Received marker node */}
      {task.receivedPct !== null && (
        <div
          style={{ left: `${task.receivedPct}%` }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-1.5 rounded-full bg-muted-foreground border border-background z-10 pointer-events-none"
        />
      )}

      {/* Start marker tick */}
      {task.startPct !== null && task.startPct > 1 && (
        <div
          style={{ left: `${task.startPct}%` }}
          className="absolute inset-y-0.5 w-[1.5px] bg-background/80 z-10 pointer-events-none"
        />
      )}

      {/* Deadline vertical pin marker */}
      {task.deadlinePct !== null && (
        <div
          style={{ left: `${task.deadlinePct}%` }}
          className="absolute -top-0.5 -bottom-0.5 w-[2px] -translate-x-1/2 bg-amber-500 dark:bg-amber-400 z-20 pointer-events-none flex flex-col items-center justify-between"
        >
          <span className="size-1.5 rotate-45 bg-amber-500 dark:bg-amber-400 -mt-0.5" />
        </div>
      )}

      {/* Foreground label positioned inside the primary active/visible region */}
      <div className="relative z-10 w-full h-full flex items-center justify-between px-1.5 gap-1 overflow-hidden pointer-events-none">
        <span
          className={`text-[10px] font-mono font-medium leading-none truncate ${
            task.workSeg || task.overdueSeg
              ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
              : "text-foreground"
          }`}
        >
          {task.text}
        </span>

        {task.deltaText && (
          <span
            className={`shrink-0 px-1 py-0.5 rounded-[2px] border text-[9px] font-mono font-semibold leading-none ${deltaBadgeTone} bg-background/90`}
          >
            {task.deltaText}
          </span>
        )}
      </div>
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
  const [sortBy, setSortBy] = useState<SortField>("deadline");
  const [hoverInfo, setHoverInfo] = useState<{
    task: WoTask;
    x: number;
    y: number;
  } | null>(null);

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
        setHoverInfo(null);
        canvasWrapRef.current?.classList.add("wo-timeline-panning");
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
      canvasWrapRef.current?.classList.remove("wo-timeline-panning");

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
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

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

  const markers = useMemo<IMarker[]>(() => {
    return [
      {
        start: new Date(),
        text: tTasks("today"),
      },
    ];
  }, [tTasks]);

  const tasks = useMemo<WoTask[]>(() => {
    const now = new Date();
    const list: WoTask[] = [];

    for (const order of orders) {
      const rawReceived =
        order.orderDate ||
        (order.rawOrder?.createdAt ? String(order.rawOrder.createdAt).split("T")[0] : "");
      const rawStarted = order.startDate;
      const rawDeadline = order.deadline;
      const rawCompleted =
        order.actualEndDate ||
        (order.status === "Completed"
          ? order.rawOrder?.actualEndDate || order.rawOrder?.completedAt
          : "");

      const receivedAt = parseOrderDate(rawReceived, "start");
      const startedAt = parseOrderDate(rawStarted, "start");
      const deadlineAt = parseOrderDate(rawDeadline, "end");
      const completedAt = parseOrderDate(rawCompleted, "end");

      if (!receivedAt && !startedAt && !deadlineAt && !completedAt) continue;

      const isFinished = order.status === "Completed" || Boolean(completedAt);
      const isCancelled = order.status === "Cancelled";

      const effectiveStart: Date | null =
        startedAt ||
        (isFinished || order.status === "Active" ? receivedAt || deadlineAt || now : null);

      let effectiveWorkEnd: Date | null = null;
      if (isFinished) {
        effectiveWorkEnd = completedAt || deadlineAt || effectiveStart || receivedAt || now;
      } else if (isCancelled) {
        effectiveWorkEnd = completedAt || effectiveStart || receivedAt || now;
      } else if (order.status === "Active" && effectiveStart) {
        effectiveWorkEnd =
          now > effectiveStart ? now : addHours(effectiveStart, 12);
      }

      const candidateDates: Date[] = [];
      if (receivedAt) candidateDates.push(receivedAt);
      if (effectiveStart) candidateDates.push(effectiveStart);
      if (effectiveWorkEnd) candidateDates.push(effectiveWorkEnd);
      if (deadlineAt) candidateDates.push(deadlineAt);
      if (completedAt) candidateDates.push(completedAt);
      if (!isFinished && !isCancelled && deadlineAt && now > deadlineAt) {
        candidateDates.push(now);
      }

      const minTime = Math.min(...candidateDates.map((d) => d.getTime()));
      const maxTime = Math.max(...candidateDates.map((d) => d.getTime()));

      const barStart = new Date(minTime);
      const rawBarEnd = new Date(maxTime);
      const barEnd =
        rawBarEnd.getTime() - barStart.getTime() >= 24 * 3600 * 1000
          ? rawBarEnd
          : addDays(barStart, 1);

      const spanMs = Math.max(1, barEnd.getTime() - barStart.getTime());
      const toPct = (d: Date) =>
        Math.max(0, Math.min(100, ((d.getTime() - barStart.getTime()) / spanMs) * 100));

      // 1. Wait / Queue segment (Received -> Started)
      let waitSeg: BarSegment | null = null;
      if (receivedAt) {
        if (effectiveStart && effectiveStart > receivedAt) {
          waitSeg = {
            left: toPct(receivedAt),
            width: toPct(effectiveStart) - toPct(receivedAt),
          };
        } else if (!effectiveStart) {
          const waitCap = deadlineAt
            ? new Date(Math.min(now.getTime(), deadlineAt.getTime()))
            : now;
          const waitTarget = waitCap > receivedAt ? waitCap : barEnd;
          if (waitTarget > receivedAt) {
            waitSeg = {
              left: toPct(receivedAt),
              width: toPct(waitTarget) - toPct(receivedAt),
            };
          }
        }
      }

      // 2. Active / Completed on-time work segment
      let workSeg: BarSegment | null = null;
      if (effectiveStart && effectiveWorkEnd && effectiveWorkEnd > effectiveStart) {
        const onTimeEnd = deadlineAt
          ? new Date(Math.min(effectiveWorkEnd.getTime(), deadlineAt.getTime()))
          : effectiveWorkEnd;
        if (onTimeEnd > effectiveStart) {
          workSeg = {
            left: toPct(effectiveStart),
            width: toPct(onTimeEnd) - toPct(effectiveStart),
          };
        }
      }

      // 3. Overdue segment (beyond Deadline)
      let overdueSeg: BarSegment | null = null;
      if (deadlineAt) {
        if (effectiveStart && effectiveWorkEnd && effectiveWorkEnd > deadlineAt) {
          const ovStart = new Date(
            Math.max(effectiveStart.getTime(), deadlineAt.getTime())
          );
          overdueSeg = {
            left: toPct(ovStart),
            width: toPct(effectiveWorkEnd) - toPct(ovStart),
          };
        } else if (!effectiveStart && !isCancelled && now > deadlineAt) {
          overdueSeg = {
            left: toPct(deadlineAt),
            width: toPct(now) - toPct(deadlineAt),
          };
        }
      }

      // 4. Buffer segment (Saved early buffer OR Planned remaining window)
      let bufferSeg: (BarSegment & { kind: "saved" | "planned" }) | null = null;
      if (deadlineAt) {
        if (isFinished && completedAt && completedAt < deadlineAt) {
          bufferSeg = {
            left: toPct(completedAt),
            width: toPct(deadlineAt) - toPct(completedAt),
            kind: "saved",
          };
        } else if (!isFinished && !isCancelled) {
          const planFrom = effectiveWorkEnd
            ? effectiveWorkEnd
            : receivedAt && now > receivedAt
            ? now
            : receivedAt || barStart;
          if (deadlineAt > planFrom) {
            bufferSeg = {
              left: toPct(planFrom),
              width: toPct(deadlineAt) - toPct(planFrom),
              kind: "planned",
            };
          }
        }
      }

      // Metrics & Delta calculation
      const waitDays =
        receivedAt && effectiveStart
          ? Math.max(0, differenceInCalendarDays(effectiveStart, receivedAt))
          : receivedAt && !effectiveStart
          ? Math.max(0, differenceInCalendarDays(now, receivedAt))
          : null;

      const workDays =
        effectiveStart && effectiveWorkEnd
          ? Math.max(1, differenceInCalendarDays(effectiveWorkEnd, effectiveStart))
          : null;

      let deltaDays: number | null = null;
      let deltaState: DeltaState = "none";
      let deltaText = "";

      if (deadlineAt && !isCancelled) {
        const refDate = isFinished && completedAt ? completedAt : now;
        const diff = differenceInCalendarDays(refDate, deadlineAt);
        deltaDays = diff;

        if (isFinished) {
          if (diff > 0) {
            deltaState = "late";
            deltaText = t("daysLate", { days: diff });
          } else if (diff < 0) {
            deltaState = "early";
            deltaText = t("daysEarly", { days: Math.abs(diff) });
          } else {
            deltaState = "ontime";
            deltaText = t("onTime");
          }
        } else {
          if (refDate > deadlineAt) {
            const lateDays = Math.max(1, diff);
            deltaState = "late";
            deltaText = t("daysLate", { days: lateDays });
          } else {
            const hoursLeft = differenceInHours(deadlineAt, now);
            const remDays = Math.abs(diff);
            if (hoursLeft <= 24) {
              deltaState = "risk";
              deltaText = t("daysLeft", { days: remDays });
            } else {
              deltaState = "left";
              deltaText = t("daysLeft", { days: remDays });
            }
          }
        }
      }

      const overdue = deltaState === "late";
      const atRisk = deltaState === "risk";

      list.push({
        id: order.id,
        text: order.id,
        customer: order.customer,
        deltaText: deltaText || "—",
        deltaState,
        start: barStart,
        end: barEnd,
        type: "task",
        status: order.status,
        overdue,
        atRisk,
        receivedAt,
        startedAt: effectiveStart,
        deadlineAt,
        completedAt: isFinished ? completedAt || effectiveWorkEnd : null,
        waitDays,
        workDays,
        deltaDays,
        waitSeg,
        workSeg,
        overdueSeg,
        bufferSeg,
        receivedPct: receivedAt ? toPct(receivedAt) : null,
        startPct: effectiveStart ? toPct(effectiveStart) : null,
        deadlinePct: deadlineAt ? toPct(deadlineAt) : null,
        completedPct: isFinished && completedAt ? toPct(completedAt) : null,
        order,
      });
    }

    list.sort((a, b) => {
      if (sortBy === "deadline") {
        const da = a.deadlineAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const db = b.deadlineAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
      } else if (sortBy === "received") {
        const ra = a.receivedAt?.getTime() ?? a.start.getTime();
        const rb = b.receivedAt?.getTime() ?? b.start.getTime();
        if (ra !== rb) return ra - rb;
      } else if (sortBy === "start") {
        const sa = a.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const sb = b.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
      }
      return a.start.getTime() - b.start.getTime();
    });

    return list;
  }, [orders, sortBy, t]);

  const tasksById = useMemo(() => {
    const map = new Map<string, WoTask>();
    tasks.forEach((task) => map.set(String(task.id), task));
    return map;
  }, [tasks]);

  const ordersById = useMemo(() => {
    const map = new Map<string, OrderRow>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (panStateRef.current.active && panStateRef.current.moved) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (!target) {
        setHoverInfo(null);
        return;
      }
      const barEl = target.closest<HTMLElement>("[data-wo-id], .wx-bar[data-task-id]");
      if (!barEl) {
        setHoverInfo(null);
        return;
      }
      const rawId =
        barEl.getAttribute("data-wo-id") || barEl.getAttribute("data-task-id");
      const foundTask = rawId ? tasksById.get(rawId) : undefined;
      if (!foundTask) {
        setHoverInfo(null);
        return;
      }
      setHoverInfo({
        task: foundTask,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [tasksById]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

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
      { id: "text", header: t("order"), width: 108 },
      { id: "customer", header: t("customer"), width: 145 },
      { id: "deltaText", header: t("delta"), width: 76, align: "right" as const },
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

  const renderHoveredTooltip = () => {
    if (!hoverInfo) return null;
    const { task, x, y } = hoverInfo;
    const o = task.order;

    const photoUrl =
      o.preview?.[0] ||
      o.allPhotos?.[0] ||
      (Array.isArray(o.rawOrder?.photoUrls) ? o.rawOrder.photoUrls[0] : undefined) ||
      o.rawOrder?.photoUrl;

    const statusLabel =
      o.status === "Active"
        ? tCommon("statusActive")
        : o.status === "Completed"
        ? tCommon("statusCompleted")
        : o.status === "Cancelled"
        ? tCommon("statusCancelled")
        : tCommon("statusDraft");

    const deltaColor =
      task.deltaState === "late"
        ? "text-rose-600 dark:text-rose-400"
        : task.deltaState === "early" || task.deltaState === "ontime"
        ? "text-emerald-600 dark:text-emerald-400"
        : task.deltaState === "risk"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

    const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const winH = typeof window !== "undefined" ? window.innerHeight : 800;
    const cardW = 300;
    const cardH = 210;
    const left = x + 16 + cardW > winW ? Math.max(8, x - cardW - 12) : x + 16;
    const top = y + 16 + cardH > winH ? Math.max(8, y - cardH - 12) : y + 16;

    return (
      <div
        style={{ left, top }}
        className="fixed z-100 pointer-events-none bg-popover text-popover-foreground border border-border rounded-md p-2.5 text-xs shadow-md min-w-[260px] max-w-[310px] space-y-2"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
          <span className="font-mono font-semibold text-foreground">{o.id}</span>
          <div className="flex items-center gap-1.5">
            {task.deltaText && task.deltaText !== "—" && (
              <span className={`font-mono text-[10px] font-semibold ${deltaColor}`}>
                {task.deltaText}
              </span>
            )}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          {photoUrl ? (
            <div className="relative shrink-0 size-11 rounded border border-border bg-muted/40 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={o.product}
                className="size-full object-cover"
              />
              {o.preview && o.preview.length > 1 && (
                <span className="absolute bottom-0 right-0 bg-background/90 text-foreground font-mono text-[9px] px-1 rounded-tl border-t border-l border-border">
                  +{o.preview.length - 1}
                </span>
              )}
            </div>
          ) : (
            <div className="shrink-0 size-11 rounded border border-border bg-muted/30 flex items-center justify-center text-muted-foreground/50">
              <ImageIcon className="size-4" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-medium text-foreground leading-tight line-clamp-2">
              {o.product}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {o.customer}
            </div>
            {o.machine && (
              <div className="text-[10px] font-mono text-muted-foreground truncate">
                {o.machine}
              </div>
            )}
          </div>
        </div>

        {/* 4 Order Dates Matrix */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-border/70 text-[11px]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">{t("received")}:</span>
            <span className="font-mono text-foreground">
              {formatShortDate(task.receivedAt, o.orderDate, dfLocale)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">{t("start")}:</span>
            <span className="font-mono text-foreground">
              {task.startedAt
                ? formatShortDate(task.startedAt, o.startDate, dfLocale)
                : t("noStart")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">{t("deadline")}:</span>
            <span className="font-mono font-medium text-foreground">
              {task.deadlineAt
                ? formatShortDate(task.deadlineAt, o.deadline, dfLocale)
                : t("noDeadline")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">{t("completed")}:</span>
            <span className="font-mono text-foreground">
              {task.completedAt
                ? formatShortDate(task.completedAt, o.actualEndDate, dfLocale)
                : t("notCompleted")}
            </span>
          </div>
        </div>

        {/* Phase Durations Footer */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/70 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="size-2 rounded-xs bg-muted border border-dashed border-muted-foreground/60" />
            <span>{t("waitPhase")}:</span>
            <span className="text-foreground font-medium">
              {task.waitDays !== null ? `${task.waitDays}${t("daysShort")}` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="size-2 rounded-xs bg-blue-500" />
            <span>{t("workPhase")}:</span>
            <span className="text-foreground font-medium">
              {task.workDays !== null ? `${task.workDays}${t("daysShort")}` : "—"}
            </span>
          </div>
          {task.overdue && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              {t("overdue")}
            </span>
          )}
          {task.atRisk && !task.overdue && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              {t("atRisk")}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="wo-timeline flex flex-col h-full w-full bg-background select-none overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 h-9 border-b border-border bg-card/60 gap-2 overflow-x-auto">
        <div className="flex items-center gap-2.5 shrink-0">
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

          {/* 4-Date Phase Legend */}
          <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-border text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-xs bg-muted border border-dashed border-muted-foreground/50" />
              <span>{t("waitPhase")}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-xs bg-blue-600/85" />
              <span>{t("workPhase")}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-xs bg-emerald-600/85" />
              <span>{t("onTime")}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-xs bg-rose-600/90 wo-segment-overdue" />
              <span>{t("overduePhase")}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-0.5 h-3 bg-amber-500" />
              <span>{t("deadline")}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort Selector by 4 Dates */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60">
            <span className="px-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="size-3" />
            </span>
            <button
              onClick={() => setSortBy("deadline")}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                sortBy === "deadline"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("deadline")}
            </button>
            <button
              onClick={() => setSortBy("received")}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                sortBy === "received"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("received")}
            </button>
            <button
              onClick={() => setSortBy("start")}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                sortBy === "start"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("start")}
            </button>
          </div>

          {/* Scale Presets */}
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
            <button
              onClick={() => handleSelectZoomPreset(3)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                activeZoomIdx === 3
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("hour")}
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
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="flex-1 min-h-0 w-full overflow-hidden"
        >
          <Willow fonts={false}>
            <Gantt
              key={`zoom-${activeZoomIdx}`}
              init={handleInit}
              tasks={tasks}
              links={[]}
              markers={markers}
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
          </Willow>
          {renderHoveredTooltip()}
        </div>
      )}
    </div>
  );
}
export default WorkOrderTimelineView;
