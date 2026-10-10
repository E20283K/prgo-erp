"use client";

import React, { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Wrench,
  ShieldCheck,
  Briefcase,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  RotateCw,
  Sunrise,
  Sunset,
  Moon,
  ExternalLink,
} from "lucide-react";
import { TaskItem, useTaskStore, TaskPriority, TaskStatus, TaskRoleCategory } from "@/store/taskStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskCalendarViewProps {
  tasks: TaskItem[];
  onSelectDate?: (dateStr: string) => void;
}

export function TaskCalendarView({ tasks, onSelectDate }: TaskCalendarViewProps) {
  const t = useTranslations("Tasks");
  const { selectTask, setCreateModalOpen } = useTaskStore();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(2026, 9, 6)); // Default to October 2026 based on mock data
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");

  // Navigation handlers
  const handlePrev = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 9, 6));
  };

  // Compute days in the active grid
  const daysInGrid = useMemo(() => {
    if (calendarMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: gridStart, end: gridEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, calendarMode]);

  // Group tasks by "YYYY-MM-DD"
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const datePart = task.dueDate.split(" ")[0]; // Handles '2026-10-06 14:00' or '2026-10-06'
      if (!map.has(datePart)) {
        map.set(datePart, []);
      }
      map.get(datePart)!.push(task);
    });
    return map;
  }, [tasks]);

  const handleDayCreateClick = (day: Date) => {
    const formatted = format(day, "yyyy-MM-dd");
    if (onSelectDate) {
      onSelectDate(formatted);
    }
    setCreateModalOpen(true);
  };

  // Helper for priority styling
  const getPriorityBorder = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
        return "border-l-red-500 bg-red-500/5 hover:bg-red-500/10";
      case "high":
        return "border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10";
      case "normal":
        return "border-l-blue-500 bg-blue-500/5 hover:bg-blue-500/10";
      default:
        return "border-l-muted-foreground/40 bg-muted/20 hover:bg-muted/40";
    }
  };

  // Helper for status icon
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
      case "in-progress":
        return <PlayCircle className="size-3 text-blue-500 shrink-0" />;
      case "blocked":
        return <AlertTriangle className="size-3 text-red-500 shrink-0" />;
      default:
        return <Clock className="size-3 text-amber-500 shrink-0" />;
    }
  };

  // Helper for role icon
  const getRoleIcon = (role: TaskRoleCategory) => {
    switch (role) {
      case "operator":
        return <Wrench className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />;
      case "manager":
        return <ShieldCheck className="size-3 text-purple-600 dark:text-purple-400 shrink-0" />;
      default:
        return <Briefcase className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
  };

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden">
      {/* ── Calendar Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-card/60 backdrop-blur-xs">
        {/* Left: Navigation and Title */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md bg-background shadow-2xs overflow-hidden">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handlePrev}
              className="h-7 w-7 rounded-none border-r border-border hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleToday}
              className="h-7 px-2.5 rounded-none font-medium text-xs hover:bg-muted"
            >
              {t("today")}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleNext}
              className="h-7 w-7 rounded-none border-l border-border hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <h2 className="text-sm font-semibold tracking-tight text-foreground ml-1">
            {format(currentDate, calendarMode === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}
          </h2>
        </div>

        {/* Right: View Toggle & Quick Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60">
            <button
              onClick={() => setCalendarMode("month")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                calendarMode === "month"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("month")}
            </button>
            <button
              onClick={() => setCalendarMode("week")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                calendarMode === "week"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("week")}
            </button>
          </div>

          <Button
            size="xs"
            onClick={() => setCreateModalOpen(true)}
            className="h-7 text-xs font-medium gap-1 shadow-2xs"
          >
            <Plus className="size-3.5" />
            <span>{t("newTask")}</span>
          </Button>
        </div>
      </div>

      {/* ── Day of week header row ── */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 shrink-0 text-center">
        {weekDayHeaders.map((dayName, idx) => (
          <div
            key={dayName}
            className={`py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase ${
              idx < 6 ? "border-r border-border/50" : ""
            } ${idx >= 5 ? "bg-muted/60 text-muted-foreground/70" : ""}`}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      <div
        className={`flex-1 grid grid-cols-7 min-h-0 overflow-y-auto bg-muted/10 ${
          calendarMode === "month" ? "auto-rows-fr" : "auto-rows-fr"
        }`}
      >
        {daysInGrid.map((day, index) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isRightEdge = (index + 1) % 7 === 0;

          return (
            <div
              key={dateKey}
              className={`group flex flex-col min-h-[110px] p-1.5 border-b border-border/60 ${
                !isRightEdge ? "border-r border-border/60" : ""
              } ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground/60" : "bg-card/40"} ${
                isWeekend && isCurrentMonth ? "bg-muted/15" : ""
              } transition-colors hover:bg-accent/15`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1 shrink-0">
                <span
                  className={`flex items-center justify-center text-xs font-medium rounded-full ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground font-semibold size-5 shadow-2xs"
                      : "text-foreground/90 size-5"
                  }`}
                >
                  {format(day, "d")}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                      {dayTasks.length}
                    </span>
                  )}
                  <button
                    onClick={() => handleDayCreateClick(day)}
                    title={t("newTask")}
                    className="size-4.5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>

              {/* Tasks List within Day */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-0.5 custom-scrollbar">
                {dayTasks.map((task) => {
                  const timeStr = task.dueDate.includes(" ") ? task.dueDate.split(" ")[1] : null;

                  return (
                    <TooltipProvider key={task.id} delay={300}>
                      <Tooltip>
                        <TooltipTrigger
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTask(task.id);
                          }}
                          className={`flex flex-col gap-0.5 px-1.5 py-1 rounded text-left border-l-2 border border-border/60 shadow-2xs cursor-pointer transition-all hover:shadow-xs active:scale-[0.99] w-full ${getPriorityBorder(
                            task.priority
                          )}`}
                        >
                          {/* Top row: ID + Status + Role */}
                          <div className="flex items-center justify-between text-[10px] leading-tight text-muted-foreground w-full">
                            <span className="font-mono font-medium text-foreground/80 flex items-center gap-1">
                              {getRoleIcon(task.roleCategory)}
                              {task.id}
                            </span>
                            <div className="flex items-center gap-1">
                              {timeStr && (
                                <span className="font-mono text-[9px] text-muted-foreground">
                                  {timeStr}
                                </span>
                              )}
                              {getStatusIcon(task.status)}
                            </div>
                          </div>

                          {/* Task title */}
                          <div className="text-[11px] font-medium leading-snug line-clamp-2 text-foreground text-left">
                            {task.title}
                          </div>

                          {/* Assignee / Reference footer */}
                          {(task.assignedTo || task.relatedId) && (
                            <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-0.5 pt-0.5 border-t border-border/30 w-full">
                              <span className="truncate max-w-[90px] font-medium">
                                {task.assignedTo}
                              </span>
                              {task.relatedId && (
                                <span className="font-mono text-[9px] text-primary/80 truncate">
                                  {task.relatedId}
                                </span>
                              )}
                            </div>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] p-2 text-xs flex flex-col gap-1 text-left">
                          <div className="font-semibold text-background flex items-center gap-1">
                            {getRoleIcon(task.roleCategory)}
                            <span>{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-background/80 line-clamp-3">
                              {task.description}
                            </p>
                          )}
                          <div className="text-[10px] text-background/70 space-y-0.5 pt-1 border-t border-background/20">
                            <div><span className="font-medium text-background">Assignee:</span> {task.assignedTo}</div>
                            {task.shift && <div><span className="font-medium text-background">Shift:</span> {task.shift}</div>}
                            <div><span className="font-medium text-background">Due:</span> {task.dueDate}</div>
                            {task.relatedName && (
                              <div><span className="font-medium text-background">Ref:</span> {task.relatedName} ({task.relatedId})</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
