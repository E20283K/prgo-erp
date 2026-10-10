"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  MoreVertical,
  Check,
  ChevronRight,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskItem, TaskStatus, TaskPriority, TaskRoleCategory, useTaskStore } from "@/store/taskStore";
import { cn } from "@/lib/utils";

interface TaskKanbanBoardProps {
  tasks: TaskItem[];
}

export function TaskKanbanBoard({ tasks }: TaskKanbanBoardProps) {
  const t = useTranslations("Tasks");
  const { selectTask, setTaskStatus, setCreateModalOpen } = useTaskStore();

  const columns: { id: TaskStatus; title: string; color: string; icon: any }[] = [
    { id: "pending", title: t("statusPending"), color: "border-zinc-300 dark:border-zinc-700 bg-zinc-500/10", icon: Clock },
    { id: "in-progress", title: t("statusInProgress"), color: "border-blue-500/40 bg-blue-500/10", icon: PlayCircle },
    { id: "blocked", title: t("statusBlocked"), color: "border-amber-500/40 bg-amber-500/10", icon: AlertTriangle },
    { id: "completed", title: t("statusCompleted"), color: "border-emerald-500/40 bg-emerald-500/10", icon: CheckCircle2 },
  ];

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 text-[10px] px-1.5 py-0 h-4">{t("priorityUrgent")}</Badge>;
      case "high":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] px-1.5 py-0 h-4">{t("priorityHigh")}</Badge>;
      case "normal":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 text-[10px] px-1.5 py-0 h-4">{t("priorityNormal")}</Badge>;
      case "low":
        return <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] px-1.5 py-0 h-4">{t("priorityLow")}</Badge>;
    }
  };

  const getCategoryIcon = (cat: TaskRoleCategory) => {
    switch (cat) {
      case "operator":
        return <PlayCircle className="w-3 h-3 text-sky-500" />;
      case "manager":
        return <ShieldCheck className="w-3 h-3 text-purple-500" />;
      case "general":
      default:
        return <Briefcase className="w-3 h-3 text-emerald-500" />;
    }
  };

  return (
    <div className="flex-1 overflow-x-auto p-3 grid grid-cols-1 md:grid-cols-4 gap-3 min-w-[900px] h-full items-start bg-background/50">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const ColIcon = col.icon;

        return (
          <div
            key={col.id}
            className="flex flex-col max-h-full rounded-lg border border-border bg-card/60 shadow-2xs overflow-hidden"
          >
            {/* Column Header */}
            <div className={cn("flex items-center justify-between px-3 py-2 border-b", col.color)}>
              <div className="flex items-center gap-1.5">
                <ColIcon className="w-4 h-4 text-foreground/80" />
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  {col.title}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-background/80 px-1.5 py-0.2 rounded-full border border-border text-foreground">
                {colTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[300px] max-h-[calc(100vh-220px)]">
              {colTasks.length === 0 ? (
                <div className="h-28 border border-dashed border-border/80 rounded-md flex items-center justify-center text-[11px] text-muted-foreground select-none">
                  {t("noTasks")}
                </div>
              ) : (
                colTasks.map((task) => {
                  const completedChecklist = task.checklist.filter((c) => c.completed).length;

                  return (
                    <Card
                      key={task.id}
                      onClick={() => selectTask(task.id)}
                      className="p-2.5 bg-card hover:bg-muted/40 transition-colors border border-border/80 shadow-2xs cursor-pointer group rounded-md space-y-2"
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-primary group-hover:underline">
                            {task.id}
                          </span>
                          <span title={task.roleCategory}>
                            {getCategoryIcon(task.roleCategory)}
                          </span>
                        </div>
                        {getPriorityBadge(task.priority)}
                      </div>

                      {/* Title */}
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                        {task.title}
                      </p>

                      {/* Linked Context Tag */}
                      {task.relatedId && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit max-w-full truncate font-mono">
                          <Layers className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{task.relatedId}</span>
                        </div>
                      )}

                      {/* Bottom row: Assignee, Checklist, Quick Move */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar className="size-5 shrink-0 rounded-full border border-border">
                            <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                              {task.assignedTo.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">
                            {task.assignedTo.split(" ")[0]}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {task.checklist.length > 0 && (
                            <span
                              className={cn(
                                "text-[10px] font-mono px-1.5 py-0.2 rounded border flex items-center gap-1",
                                completedChecklist === task.checklist.length
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              <Check className="w-2.5 h-2.5" />
                              {completedChecklist}/{task.checklist.length}
                            </span>
                          )}

                          {/* Quick advance status dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="size-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              {col.id !== "pending" && (
                                <DropdownMenuItem onClick={() => setTaskStatus(task.id, "pending")}>
                                  {t("statusPending")}
                                </DropdownMenuItem>
                              )}
                              {col.id !== "in-progress" && (
                                <DropdownMenuItem onClick={() => setTaskStatus(task.id, "in-progress")}>
                                  {t("statusInProgress")}
                                </DropdownMenuItem>
                              )}
                              {col.id !== "blocked" && (
                                <DropdownMenuItem onClick={() => setTaskStatus(task.id, "blocked")}>
                                  {t("statusBlocked")}
                                </DropdownMenuItem>
                              )}
                              {col.id !== "completed" && (
                                <DropdownMenuItem onClick={() => setTaskStatus(task.id, "completed")}>
                                  {t("statusCompleted")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
