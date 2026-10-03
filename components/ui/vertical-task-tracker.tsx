"use client";

import React, { useState } from "react";
import { Check, Clock, AlertTriangle, PlayCircle, Plus, Trash2, MoreVertical, GripVertical, ChevronsUpDown, X, User } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProductionMilestone, FLOOR_OPERATORS } from "../documents/work-order/types";

function getOperatorInitials(name?: string): string {
  if (!name || name === "Unassigned") return "?";
  const clean = name.replace(/\([^)]*\)/g, "").trim();
  const parts = clean.split(/[\s.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getOperatorColor(name?: string): string {
  if (!name || name === "Unassigned") {
    return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
  const lower = name.toLowerCase();
  if (lower.includes("prepress")) return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
  if (lower.includes("press")) return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (lower.includes("finish") || lower.includes("die-cut") || lower.includes("lamination")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (lower.includes("warehouse")) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
}

function OperatorCombobox({
  assignedTo,
  onAssign,
}: {
  assignedTo?: string;
  onAssign?: (assignee: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={assignedTo ? `Assigned to: ${assignedTo} (Click to change)` : "Unassigned (Click to assign)"}
            className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <Avatar className={cn(
              "size-6 shrink-0 rounded-full transition-all",
              assignedTo 
                ? "border border-border/50 shadow-2xs" 
                : "border border-dashed border-zinc-400/80 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-400 bg-zinc-100/60 dark:bg-zinc-800/60"
            )}>
              <AvatarFallback className={cn(
                "text-[10px] font-bold select-none",
                assignedTo ? getOperatorColor(assignedTo) : "bg-transparent text-zinc-400 hover:text-blue-500"
              )}>
                {assignedTo ? getOperatorInitials(assignedTo) : <User className="w-3.5 h-3.5 text-zinc-400 hover:text-blue-500" />}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 p-0 shadow-xl border border-border overflow-hidden bg-popover"
      >
        <Command className="w-full">
          <CommandInput placeholder="Search operator or dept..." className="h-8 text-xs" />
          <CommandList className="max-h-56 p-1">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              No operator found.
            </CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  onAssign?.("");
                  setOpen(false);
                }}
                className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer py-1.5"
              >
                <Avatar className="size-6 shrink-0 border border-dashed border-zinc-300 dark:border-zinc-700">
                  <AvatarFallback className="bg-transparent text-zinc-400 text-xs">✕</AvatarFallback>
                </Avatar>
                <span className="italic">Clear Assignment</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Floor Operators & Depts">
              {FLOOR_OPERATORS.map((op) => {
                const isSelected = assignedTo === op;
                return (
                  <CommandItem
                    key={op}
                    value={op}
                    onSelect={() => {
                      onAssign?.(op);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer py-1.5"
                  >
                    <Avatar className="size-6 shrink-0 border border-border/50">
                      <AvatarFallback className={cn("text-[10px] font-bold", getOperatorColor(op))}>
                        {getOperatorInitials(op)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground truncate flex-1">{op}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-auto" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface VerticalTaskTrackerProps {
  milestones: ProductionMilestone[];
  onStatusChange?: (id: string, status: ProductionMilestone["status"]) => void;
  onAssign?: (id: string, assignee: string) => void;
  onRemove?: (id: string) => void;
  onAdd?: (name: string, dept: string) => void;
  onReorder?: (newMilestones: ProductionMilestone[]) => void;
  readOnly?: boolean;
}

const statusConfig = {
  "Pending": {
    icon: Clock,
    colorClass: "text-zinc-400 dark:text-zinc-500",
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-300 dark:border-zinc-700",
  },
  "In Progress": {
    icon: PlayCircle,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    borderClass: "border-blue-300 dark:border-blue-700",
  },
  "Done": {
    icon: Check,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    borderClass: "border-emerald-400 dark:border-emerald-700",
  },
  "Issue": {
    icon: AlertTriangle,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/40",
    borderClass: "border-red-400 dark:border-red-700",
  },
};

export function VerticalTaskTracker({
  milestones,
  onStatusChange,
  onAssign,
  onRemove,
  onAdd,
  onReorder,
  readOnly = false,
}: VerticalTaskTrackerProps) {
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDept, setNewTaskDept] = useState("Prepress");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim() && onAdd) {
      onAdd(newTaskName.trim(), newTaskDept.trim() || "General");
      setNewTaskName("");
      setNewTaskDept("Prepress");
      setIsAddPopoverOpen(false);
    }
  };

  if (!milestones) return null;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="relative pl-3">
        {/* Vertical Track Line */}
        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-zinc-200 dark:bg-zinc-800 -z-10" />

        <div className="space-y-4">
          {milestones.map((milestone, idx) => {
            const config = statusConfig[milestone.status] || statusConfig["Pending"];
            const Icon = config.icon;

            return (
              <div 
                key={milestone.id} 
                draggable={!readOnly}
                onDragStart={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button") || target.closest("input") || target.closest("[data-slot='dropdown-menu-trigger']")) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", idx.toString());
                  setDraggedIdx(idx);
                }}
                onDragOver={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverIdx !== idx) {
                    setDragOverIdx(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) {
                    setDragOverIdx(null);
                  }
                }}
                onDrop={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                  const fromIdx = draggedIdx ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
                  const toIdx = idx;
                  if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== toIdx) {
                    const updated = [...milestones];
                    const [moved] = updated.splice(fromIdx, 1);
                    updated.splice(toIdx, 0, moved);
                    onReorder?.(updated);
                  }
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className={cn(
                  "flex items-start gap-3 group relative transition-all duration-150",
                  draggedIdx === idx && "opacity-40 scale-[0.98]",
                  dragOverIdx === idx && draggedIdx !== idx && "translate-y-0.5"
                )}
              >
                <div className={cn(
                  "w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center bg-white dark:bg-zinc-950 z-10 transition-colors shadow-sm",
                  config.borderClass,
                  config.bgClass
                )}>
                  <Icon className={cn("w-3.5 h-3.5", config.colorClass)} />
                </div>

                <div className={cn(
                  "flex-1 min-w-0 bg-white dark:bg-zinc-900 border rounded-md px-2.5 py-1.5 shadow-2xs flex items-center justify-between gap-3 transition-all",
                  dragOverIdx === idx && draggedIdx !== idx
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                    : "border-zinc-200 dark:border-zinc-800 group-hover:border-zinc-300 dark:group-hover:border-zinc-700"
                )}>
                  {/* Task Name & Department */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn(
                      "text-xs font-semibold truncate text-zinc-900 dark:text-zinc-100",
                      milestone.status === "Done" && "text-zinc-500 line-through dark:text-zinc-500"
                    )}>
                      {milestone.name}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                      {milestone.department}
                    </span>
                  </div>

                  {/* Right side: Avatar (only avatar icon) + More Menu + Grip Handle */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {readOnly ? (
                      <div title={milestone.assignedTo ? `Assigned to: ${milestone.assignedTo}` : "Unassigned"}>
                        <Avatar className={cn(
                          "size-6 shrink-0 rounded-full",
                          milestone.assignedTo 
                            ? "border border-border/50 shadow-2xs" 
                            : "border border-dashed border-zinc-400/80 dark:border-zinc-600 bg-zinc-100/60 dark:bg-zinc-800/60"
                        )}>
                          <AvatarFallback className={cn(
                            "text-[10px] font-bold select-none",
                            milestone.assignedTo ? getOperatorColor(milestone.assignedTo) : "bg-transparent text-zinc-400"
                          )}>
                            {milestone.assignedTo ? getOperatorInitials(milestone.assignedTo) : <User className="w-3.5 h-3.5 text-zinc-400" />}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <OperatorCombobox
                        assignedTo={milestone.assignedTo}
                        onAssign={(newAssignee) => onAssign?.(milestone.id, newAssignee)}
                      />
                    )}

                    {!readOnly && (
                      <div className="flex items-center gap-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="text-xs w-44">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500">Set Status</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Done")} className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Done
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "In Progress")} className="flex items-center gap-2">
                                <PlayCircle className="w-3.5 h-3.5 text-blue-600" /> In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Issue")} className="flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Issue
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Pending")} className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Pending
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onRemove?.(milestone.id)} className="text-red-600 focus:text-red-600 flex items-center gap-2">
                              <Trash2 className="w-3.5 h-3.5" /> Remove Task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div 
                          className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <div className="pl-10 pr-1">
          <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
            <PopoverTrigger
              render={
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 text-xs border-dashed text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 shadow-none font-medium gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Custom Task
                </Button>
              }
            />
            <PopoverContent
              align="center"
              sideOffset={8}
              className="w-80 p-3.5 shadow-xl border border-border bg-popover space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Production Task</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPopoverOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block">Task Name *</label>
                  <Input 
                    placeholder="e.g. UV Coating, Foil Stamping, QC Inspection" 
                    value={newTaskName} 
                    onChange={e => setNewTaskName(e.target.value)}
                    className="h-8 text-xs bg-background"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block">Department / Stage</label>
                  <Select value={newTaskDept} onValueChange={(val) => val && setNewTaskDept(val)}>
                    <SelectTrigger className="h-8 text-xs bg-background w-full">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prepress">Prepress</SelectItem>
                      <SelectItem value="Offset">Offset</SelectItem>
                      <SelectItem value="Flexo">Flexo</SelectItem>
                      <SelectItem value="Finishing">Finishing</SelectItem>
                      <SelectItem value="Warehouse">Warehouse</SelectItem>
                      <SelectItem value="Quality Control">Quality Control</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs px-2.5 text-muted-foreground" 
                    onClick={() => setIsAddPopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={!newTaskName.trim()}
                    className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
                  >
                    Add Task
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
