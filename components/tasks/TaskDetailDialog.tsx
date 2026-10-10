"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  User,
  Calendar,
  Layers,
  ShieldCheck,
  Briefcase,
  Wrench,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Sunrise,
  Sunset,
  Moon,
  RotateCw,
  PlayCircle,
} from "lucide-react";
import { useTaskStore, TaskItem, TaskStatus, TaskPriority, TaskRoleCategory } from "@/store/taskStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  ASSIGNEE_COMBOBOX_OPTIONS,
  ERP_ENTITY_COMBOBOX_OPTIONS,
} from "./CreateTaskModal";
import { cn } from "@/lib/utils";

const CATEGORY_COMBOBOX_OPTIONS: ComboboxItem[] = [
  { value: "operator", label: "Operator Tasks", description: "Shop-floor operations, press calibration & maintenance", badge: "Shop Floor", icon: Wrench },
  { value: "manager", label: "Manager Tasks", description: "Shift management, approvals & quality control", badge: "Management", icon: ShieldCheck },
  { value: "general", label: "CRM / Commercial Tasks", description: "Sales follow-ups, invoices & general tasks", badge: "Commercial", icon: Briefcase },
];

const SHIFT_COMBOBOX_OPTIONS: ComboboxItem[] = [
  { value: "Morning", label: "Morning Shift (08:00 - 16:00)", badge: "Shift 1", icon: Sunrise },
  { value: "Evening", label: "Evening Shift (16:00 - 00:00)", badge: "Shift 2", icon: Sunset },
  { value: "Night", label: "Night Shift (00:00 - 08:00)", badge: "Shift 3", icon: Moon },
  { value: "All", label: "All Shifts (Full Day)", badge: "All Day", icon: RotateCw },
];

const STATUS_COMBOBOX_OPTIONS: ComboboxItem[] = [
  { value: "pending", label: "To Do / Pending", badge: "To Do", icon: Clock },
  { value: "in-progress", label: "In Progress", badge: "Active", icon: PlayCircle },
  { value: "blocked", label: "Blocked / Issue", badge: "Issue", icon: AlertTriangle },
  { value: "completed", label: "Completed", badge: "Done", icon: CheckCircle2 },
];

export function TaskDetailDialog() {
  const t = useTranslations("Tasks");
  const tCommon = useTranslations("Common");
  const {
    tasks,
    selectedTaskId,
    isDetailDialogOpen,
    setDetailDialogOpen,
    updateTask,
    deleteTask,
    toggleChecklistItem,
    addChecklistItem,
  } = useTaskStore();

  const { openTab, currentUser } = useWorkspaceStore();

  const task = tasks.find((t) => t.id === selectedTaskId);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  if (!task) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(task.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTask(task.id, { status });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTask(task.id, { priority });
  };

  const handleCategoryChange = (roleCategory: TaskRoleCategory) => {
    updateTask(task.id, { roleCategory });
  };

  const handleAssigneeChange = (assignedTo: string) => {
    updateTask(task.id, { assignedTo });
  };

  const handleDateChange = (dateVal: string) => {
    const timePart = task.dueDate.split(" ")[1] || "18:00";
    updateTask(task.id, { dueDate: `${dateVal} ${timePart}` });
  };

  const handleAddChecklist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChecklistText.trim()) return;
    addChecklistItem(task.id, newChecklistText);
    setNewChecklistText("");
  };

  const handleRemoveChecklistItem = (checkId: string) => {
    const updated = task.checklist.filter((c) => c.id !== checkId);
    updateTask(task.id, { checklist: updated });
  };

  const handleJumpToEntity = () => {
    if (!task.relatedId) return;

    if (task.relatedType === "work-order" || task.relatedId.startsWith("WO-")) {
      openTab({
        id: task.relatedId,
        title: `${task.relatedId}: ${task.relatedName || "Work Order"}`,
        type: "work-order",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          docNo: task.relatedId,
          customer: "Alpha Media Group LLC",
          product: task.relatedName || "A4 Hardcover Catalog 96p",
        },
      });
      setDetailDialogOpen(false);
    } else if (task.relatedType === "client-order" || task.relatedId.startsWith("CO-")) {
      openTab({
        id: task.relatedId,
        title: `${task.relatedId}: ${task.relatedName || "Client Order"}`,
        type: "client-order",
        module: "sales",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          docNo: task.relatedId,
          customer: "Alpha Media Group LLC",
          product: task.relatedName || "A4 Hardcover Catalog 96p",
        },
      });
      setDetailDialogOpen(false);
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300">{t("priorityUrgent")}</Badge>;
      case "high":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">{t("priorityHigh")}</Badge>;
      case "normal":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300">{t("priorityNormal")}</Badge>;
      case "low":
        return <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{t("priorityLow")}</Badge>;
    }
  };

  const getCategoryBadge = (cat: TaskRoleCategory) => {
    switch (cat) {
      case "operator":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300/60">
            <Wrench className="size-3 text-sky-600" />
            {t("operatorTasks")}
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300/60">
            <ShieldCheck className="size-3 text-purple-600" />
            {t("managerTasks")}
          </span>
        );
      case "general":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60">
            <Briefcase className="size-3 text-emerald-600" />
            {t("generalTasks")}
          </span>
        );
    }
  };

  const completedChecklistCount = task.checklist.filter((c) => c.completed).length;
  const progressPercent = task.checklist.length > 0 
    ? Math.round((completedChecklistCount / task.checklist.length) * 100) 
    : 0;

  const dateOnly = task.dueDate.split(" ")[0] || "2026-10-06";

  return (
    <Dialog open={isDetailDialogOpen} onOpenChange={setDetailDialogOpen}>
      <DialogContent
        style={{
          width: "min(960px, 92vw)",
          maxWidth: "min(960px, 92vw)",
          height: "min(680px, 82vh)",
          maxHeight: "82vh",
        }}
        className="!w-[min(960px,92vw)] !max-w-[min(960px,92vw)] sm:!max-w-[min(960px,92vw)] md:!max-w-[min(960px,92vw)] lg:!max-w-[min(960px,92vw)] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl rounded-xl"
      >
        {/* Header */}
        <DialogHeader className="px-5 py-3 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyId}
                title="Click to copy Task ID"
                className="font-mono text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <span>{task.id}</span>
                {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 opacity-60" />}
              </button>

              {getCategoryBadge(task.roleCategory)}
              {getPriorityBadge(task.priority)}

              {task.assignedBy && (
                <span className="text-xs text-muted-foreground hidden sm:inline ml-1">
                  {t("assignedBy")}: <strong className="text-foreground">{task.assignedBy}</strong>
                </span>
              )}
            </div>

            {/* Quick Status Dropdown (with Lucide icons) */}
            <div className="flex items-center gap-2 mr-6 w-44">
              <SmartCombobox
                value={task.status}
                onChange={(val) => handleStatusChange(val as TaskStatus)}
                options={STATUS_COMBOBOX_OPTIONS}
                allowCustom={false}
                className={cn(
                  "h-7 text-xs font-semibold px-2 rounded-lg",
                  task.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300" :
                  task.status === "in-progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300" :
                  task.status === "blocked" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300" :
                  "bg-background text-foreground"
                )}
                popoverWidth="w-48"
              />
            </div>
          </div>

          <DialogTitle className="text-base font-semibold leading-snug mt-1.5 text-foreground">
            {task.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("dialogTitle")}
          </DialogDescription>
        </DialogHeader>

        {/* 2-Column Balanced Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* ── Left Column: Primary Content (7 cols) ── */}
          <div className="md:col-span-7 space-y-4">
            {/* Linked ERP Document Banner */}
            {task.relatedId ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Layers className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-primary font-bold">{task.relatedId}</span>
                      {task.relatedName && (
                        <span className="text-muted-foreground font-normal truncate">
                          — {task.relatedName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t("linkedDocument")} ({task.relatedType || "Document"})
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleJumpToEntity}
                  className="h-7 text-xs gap-1 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 shrink-0 font-medium px-2.5"
                >
                  <ExternalLink className="size-3" />
                  {t("jumpToLinked")}
                </Button>
              </div>
            ) : null}

            {/* Description / Standard Procedure */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" />
                <span>{t("fieldDescription")}</span>
              </label>
              <div className="text-xs text-foreground bg-muted/20 p-3 rounded-lg border border-border/80 leading-relaxed font-sans whitespace-pre-wrap shadow-2xs min-h-[75px]">
                {task.description || "No specific instructions provided."}
              </div>
            </div>

            {/* Checklist Section with Progress Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    <span>{t("checklistTitle")}</span>
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                    {completedChecklistCount} / {task.checklist.length} ({progressPercent}%)
                  </Badge>
                </div>

                <span className="text-[11px] text-muted-foreground font-medium">
                  {t("checklistProgress")}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Checklist items list */}
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-muted/20">
                {task.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-md transition-colors text-xs bg-background border border-border/60 shadow-2xs group"
                  >
                    <div
                      onClick={() => toggleChecklistItem(task.id, item.id)}
                      className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleChecklistItem(task.id, item.id)}
                      />
                      <span
                        className={cn(
                          "flex-1 text-xs transition-all",
                          item.completed
                            ? "line-through text-muted-foreground"
                            : "text-foreground font-medium"
                        )}
                      >
                        {item.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="size-5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}

                {/* Add new checklist item input */}
                <form onSubmit={handleAddChecklist} className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <Input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder={t("checklistPlaceholder")}
                    className="h-7 text-xs bg-background"
                  />
                  <Button type="submit" variant="secondary" size="sm" className="h-7 px-2.5 text-xs shrink-0 font-medium">
                    <Plus className="size-3 mr-1" />
                    {tCommon("create")}
                  </Button>
                </form>
              </div>
            </div>

            {/* Resolution Notes & Handover */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-primary" />
                <span>{t("resolutionNotes")}</span>
              </label>
              <Textarea
                value={task.notes || ""}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                placeholder={t("resolutionNotesPlaceholder")}
                className="text-xs resize-none min-h-[75px] bg-background p-2.5"
              />
            </div>
          </div>

          {/* ── Right Column: Metadata & Inspector (5 cols) ── */}
          <div className="md:col-span-5 space-y-3 bg-muted/20 p-4 rounded-xl border border-border/80">
            {/* Priority */}
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1">
                {t("fieldPriority")}
              </label>
              <Select
                value={task.priority}
                onValueChange={(val: any) => val && handlePriorityChange(val)}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="urgent">🔴 {t("priorityUrgent")}</SelectItem>
                  <SelectItem value="high">🟠 {t("priorityHigh")}</SelectItem>
                  <SelectItem value="normal">🔵 {t("priorityNormal")}</SelectItem>
                  <SelectItem value="low">⚪ {t("priorityLow")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee (Searchable Combobox) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  {t("fieldAssignee")}
                </label>
                <button
                  type="button"
                  onClick={() => handleAssigneeChange(currentUser.name)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <User className="size-3" />
                  {t("assignToMe")}
                </button>
              </div>
              <SmartCombobox
                value={task.assignedTo}
                onChange={handleAssigneeChange}
                options={ASSIGNEE_COMBOBOX_OPTIONS}
                placeholder="Search assignee..."
                searchPlaceholder="Search operator, manager, or queue..."
                allowCustom={true}
                className="h-8 text-xs bg-background"
                popoverWidth="w-[340px]"
              />
            </div>

            {/* Category / Role (Combobox with Lucide icon) */}
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1">
                {t("fieldCategory")}
              </label>
              <SmartCombobox
                value={task.roleCategory}
                onChange={(val) => handleCategoryChange(val as TaskRoleCategory)}
                options={CATEGORY_COMBOBOX_OPTIONS}
                allowCustom={false}
                className="h-8 text-xs bg-background"
                popoverWidth="w-[320px]"
              />
            </div>

            {/* Schedule & Shift (with Lucide icons) */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                    {t("fieldDueDate")}
                  </label>
                  <DatePicker
                    value={dateOnly}
                    onChange={(val) => handleDateChange(val || "2026-10-06")}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                    {t("fieldShift")}
                  </label>
                  <SmartCombobox
                    value={task.shift || "Morning"}
                    onChange={(val) => updateTask(task.id, { shift: val as any })}
                    options={SHIFT_COMBOBOX_OPTIONS}
                    allowCustom={false}
                    className="h-8 text-xs bg-background"
                    popoverWidth="w-[280px]"
                  />
                </div>
              </div>
            </div>

            {/* Audit / Metadata */}
            <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="text-foreground">{task.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span>Due Date:</span>
                <span className="text-foreground">{task.dueDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="m-0 sm:m-0 px-6 py-3 border-t border-border bg-muted/40 flex items-center justify-between sm:justify-between shrink-0 rounded-b-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => deleteTask(task.id)}
            className="text-destructive hover:bg-destructive/10 h-8 px-3 text-xs gap-1.5"
          >
            <Trash2 className="size-3.5" />
            {t("deleteTask")}
          </Button>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant={task.status === "completed" ? "outline" : "secondary"}
              size="sm"
              onClick={() => handleStatusChange(task.status === "completed" ? "pending" : "completed")}
              className="h-8 px-3.5 text-xs gap-1.5 font-medium"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {task.status === "completed" ? "Reopen Task" : t("markCompleted")}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setDetailDialogOpen(false)}
              className="h-8 px-5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              {t("saveAndClose")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
