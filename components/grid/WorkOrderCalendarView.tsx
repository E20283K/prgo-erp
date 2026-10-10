"use client";

import React, { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  ExternalLink,
  Layers,
  X,
  Search,
  Filter,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrderRow } from "./DataGrid";

interface WorkOrderCalendarViewProps {
  orders: OrderRow[];
  onOpenOrder?: (order: OrderRow) => void;
  onCreateNew?: () => void;
  currentDate?: Date;
  onDateChange?: (d: Date) => void;
  calendarMode?: "month" | "week" | "day";
  onCalendarModeChange?: (mode: "month" | "week" | "day") => void;
}

export function WorkOrderCalendarView({
  orders,
  onOpenOrder,
  onCreateNew,
  currentDate: externalDate,
  onDateChange: externalSetDate,
  calendarMode: externalMode,
  onCalendarModeChange: externalSetMode,
}: WorkOrderCalendarViewProps) {
  const tCommon = useTranslations("Common");
  const tGrid = useTranslations("DataGrid");
  const tTasks = useTranslations("Tasks");
  const { openTab } = useWorkspaceStore();

  // Anchor to October 2026 where all mock orders are scheduled
  const [internalDate, setInternalDate] = useState<Date>(() => new Date(2026, 9, 6));
  const [internalMode, setInternalMode] = useState<"month" | "week" | "day">("month");

  const currentDate = externalDate ?? internalDate;
  const setCurrentDate = (updater: Date | ((prev: Date) => Date)) => {
    if (externalSetDate) {
      if (typeof updater === "function") {
        externalSetDate(updater(currentDate));
      } else {
        externalSetDate(updater);
      }
    } else {
      setInternalDate(updater);
    }
  };

  const calendarMode = externalMode ?? internalMode;
  const setCalendarMode = (mode: "month" | "week" | "day") => {
    if (externalSetMode) {
      externalSetMode(mode);
    } else {
      setInternalMode(mode);
    }
  };

  // Selected Day Modal for overflowing orders
  const [selectedDayModal, setSelectedDayModal] = useState<{
    date: Date;
    orders: OrderRow[];
  } | null>(null);
  const [modalSearch, setModalSearch] = useState("");

  // Navigation handlers
  const handlePrev = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else if (calendarMode === "week") {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => subDays(prev, 1));
    }
  };

  const handleNext = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else if (calendarMode === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addDays(prev, 1));
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
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: gridStart, end: gridEnd });
    } else if (calendarMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [currentDate];
    }
  }, [currentDate, calendarMode]);

  // Index orders by deadline date: YYYY-MM-DD
  const ordersByDate = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    orders.forEach((order) => {
      const datePart = order.deadline ? order.deadline.split(" ")[0] : null;
      if (!datePart) return;
      if (!map.has(datePart)) {
        map.set(datePart, []);
      }
      map.get(datePart)!.push(order);
    });
    return map;
  }, [orders]);

  const handleOrderClick = (order: OrderRow) => {
    if (onOpenOrder) {
      onOpenOrder(order);
      return;
    }
    openTab({
      id: order.id,
      title: `${order.id}: Production Order`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: order.id,
        customer: order.customer,
        product: order.product,
        department: order.department,
        site: order.site,
        quantity: order.qty,
        unit: order.unit,
        status: order.status,
        priority: order.priority,
        pressMachine: order.machine,
        startDate: order.startDate,
        deadline: order.deadline,
        priceTotal: order.priceTotal,
        currency: "USD",
        responsible: order.responsible,
      },
    });
  };

  const getPriorityStyle = (priority: OrderRow["priority"]) => {
    switch (priority) {
      case "Urgent":
        return "border-l-red-500 bg-red-500/5 hover:bg-red-500/10";
      case "High":
        return "border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10";
      default:
        return "border-l-blue-500 bg-blue-500/5 hover:bg-blue-500/10";
    }
  };

  const getStatusBadge = (status: OrderRow["status"]) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
      case "Active":
        return <PlayCircle className="size-3 text-blue-500 shrink-0" />;
      case "Cancelled":
        return <AlertTriangle className="size-3 text-red-500 shrink-0" />;
      default:
        return <Clock className="size-3 text-amber-500 shrink-0" />;
    }
  };

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Filtered orders in modal
  const modalFilteredOrders = useMemo(() => {
    if (!selectedDayModal) return [];
    if (!modalSearch.trim()) return selectedDayModal.orders;
    const q = modalSearch.toLowerCase();
    return selectedDayModal.orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.department.toLowerCase().includes(q)
    );
  }, [selectedDayModal, modalSearch]);

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
              {tTasks("today")}
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
            {calendarMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : calendarMode === "week"
              ? format(currentDate, "'Week of' MMM d, yyyy")
              : format(currentDate, "EEEE, MMMM d, yyyy")}
          </h2>

          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground ml-2">
            Targeting Deadlines
          </Badge>
        </div>

        {/* Right: View Mode Toggle & Quick Create */}
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
              {tTasks("month")}
            </button>
            <button
              onClick={() => setCalendarMode("week")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                calendarMode === "week"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tTasks("week")}
            </button>
            <button
              onClick={() => setCalendarMode("day")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                calendarMode === "day"
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
              className="h-7 text-xs font-medium gap-1 shadow-2xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="size-3.5" />
              <span>{tGrid("createNew")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Day of week header row (Month & Week view only) ── */}
      {calendarMode !== "day" && (
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
      )}

      {/* ── Calendar Grid / Day Hourly Timeline ── */}
      {calendarMode === "day" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-muted/5">
          {/* Day Summary Top Bar */}
          <div className="px-4 py-2 border-b border-border bg-card/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center text-sm font-bold rounded-full bg-primary text-primary-foreground size-7 shadow-2xs">
                {format(currentDate, "d")}
              </span>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {format(currentDate, "EEEE, MMMM d, yyyy")}
                </span>
                <span className="text-[11px] text-muted-foreground ml-2">
                  Daily Production Schedule & Hourly Run Slots
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono font-medium">
                {(ordersByDate.get(format(currentDate, "yyyy-MM-dd")) || []).length} Orders Scheduled
              </Badge>
            </div>
          </div>

          {/* Hourly Timeline Grid */}
          <div className="flex-1 min-h-0 divide-y divide-border/60">
            {Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => {
              const hourLabel = `${String(hour).padStart(2, "0")}:00`;
              const dayDateKey = format(currentDate, "yyyy-MM-dd");
              const allDayOrders = ordersByDate.get(dayDateKey) || [];

              // Map orders to hour slot: if order deadline/startDate contains hour, or distribute by index
              const slotOrders = allDayOrders.filter((order, idx) => {
                if (order.deadline && order.deadline.includes(` ${hourLabel}`)) {
                  return true;
                }
                // Evenly distribute mock day orders across 08:00 - 20:00 slots
                return idx % 13 === hour - 8;
              });

              return (
                <div key={hour} className="flex min-h-[76px] hover:bg-accent/10 transition-colors group">
                  {/* Time Axis Column */}
                  <div className="w-20 shrink-0 p-2.5 border-r border-border/60 bg-muted/20 flex flex-col items-start justify-start select-none">
                    <span className="text-xs font-mono font-semibold text-foreground/80 flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      {hourLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"}
                    </span>
                  </div>

                  {/* Slot Orders Track */}
                  <div className="flex-1 p-2 flex flex-wrap items-center gap-2 min-h-full">
                    {slotOrders.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/40 italic pl-1 group-hover:text-muted-foreground/70 transition-colors">
                        No orders scheduled for {hourLabel}
                      </span>
                    ) : (
                      slotOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => handleOrderClick(order)}
                          className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-md border border-border/70 shadow-2xs cursor-pointer transition-all hover:shadow-xs active:scale-[0.99] border-l-4 min-w-[260px] max-w-[420px] bg-card ${getPriorityStyle(
                            order.priority
                          )}`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-xs text-foreground">
                                {order.id}
                              </span>
                              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                                {order.department}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                • {order.machine}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-foreground truncate max-w-[220px]">
                              {order.product}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              <span>Customer: <strong className="text-foreground/90">{order.customer}</strong></span>
                              <span>Qty: <strong className="text-foreground/90 font-mono">{order.qty.toLocaleString()} {order.unit}</strong></span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1">
                              {getStatusBadge(order.status)}
                              <span className="text-[11px] font-semibold">{order.status}</span>
                            </div>
                            <span className="font-mono text-xs font-semibold text-foreground">
                              ${order.priceTotal.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Lead: {order.responsible}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className={`flex-1 grid grid-cols-7 min-h-0 overflow-y-auto bg-muted/10 auto-rows-fr`}
        >
          {daysInGrid.map((day, index) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayOrders = ordersByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isRightEdge = (index + 1) % 7 === 0;

          // In month view, limit to 2 prominent cards then show "+N more" badge
          // In week view, there is plenty of vertical space so show up to 6 cards
          const maxVisible = calendarMode === "month" ? 2 : 6;
          const visibleOrders = dayOrders.slice(0, maxVisible);
          const remainingCount = dayOrders.length - maxVisible;

          return (
            <div
              key={dateKey}
              className={`group flex flex-col min-h-[120px] p-1.5 border-b border-border/60 ${
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

                <div className="flex items-center gap-1">
                  {dayOrders.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedDayModal({ date: day, orders: dayOrders });
                        setModalSearch("");
                      }}
                      title="View all orders for this day"
                      className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {dayOrders.length} orders
                    </button>
                  )}
                  {onCreateNew && (
                    <button
                      onClick={onCreateNew}
                      title={tGrid("createNew")}
                      className="size-4.5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Work Orders List within Day */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden pr-0.5">
                {visibleOrders.map((order) => {
                  return (
                    <TooltipProvider key={order.id} delay={300}>
                      <Tooltip>
                        <TooltipTrigger
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order);
                          }}
                          className={`flex flex-col gap-0.5 px-1.5 py-1 rounded text-left border-l-2 border border-border/60 shadow-2xs cursor-pointer transition-all hover:shadow-xs active:scale-[0.99] w-full ${getPriorityStyle(
                            order.priority
                          )}`}
                        >
                          {/* Top row: Order Doc ID + Status + Tech */}
                          <div className="flex items-center justify-between text-[10px] leading-tight text-muted-foreground w-full">
                            <span className="font-mono font-semibold text-foreground/90 flex items-center gap-1">
                              {order.id}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] uppercase font-mono px-1 py-0 rounded bg-muted text-muted-foreground">
                                {order.department}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>
                          </div>

                          {/* Customer & Product Description */}
                          <div className="text-[11px] font-medium leading-snug line-clamp-1 text-foreground text-left">
                            {order.product}
                          </div>

                          {/* Customer & Machine details */}
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-0.5 pt-0.5 border-t border-border/30 w-full">
                            <span className="truncate max-w-[85px] font-medium text-foreground/80">
                              {order.customer}
                            </span>
                            <span className="truncate max-w-[85px] font-mono text-muted-foreground">
                              {order.machine.split(" ")[0]}
                            </span>
                          </div>
                        </TooltipTrigger>

                        <TooltipContent side="right" className="max-w-[280px] p-2 text-xs flex flex-col gap-1 text-left">
                          <div className="font-semibold text-background flex items-center justify-between gap-1">
                            <span className="font-mono">{order.id}</span>
                            <Badge variant="outline" className="text-[9px] border-background/40 text-background">
                              {order.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-background/90 font-medium">
                            {order.product}
                          </div>
                          <div className="text-[10px] text-background/80 space-y-0.5 pt-1 border-t border-background/20">
                            <div><span className="font-medium text-background">Customer:</span> {order.customer}</div>
                            <div><span className="font-medium text-background">Workstation:</span> {order.machine}</div>
                            <div><span className="font-medium text-background">Run Qty:</span> {order.qty.toLocaleString()} {order.unit}</div>
                            <div><span className="font-medium text-background">Total:</span> ${order.priceTotal.toLocaleString()} USD</div>
                            <div><span className="font-medium text-background">Manager:</span> {order.responsible}</div>
                            <div><span className="font-medium text-background">Start Date:</span> {order.startDate}</div>
                            <div><span className="font-medium text-background">Deadline:</span> {order.deadline}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}

                {/* Clean '+N more' Pill Button to prevent clutter */}
                {remainingCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayModal({ date: day, orders: dayOrders });
                      setModalSearch("");
                    }}
                    className="w-full text-center text-[10px] font-medium font-mono py-0.5 px-1 rounded bg-muted/80 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-dashed border-border/70 mt-auto cursor-pointer"
                  >
                    +{remainingCount} more orders
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ── Day Details Inspection Modal for Dense Days ── */}
      <Dialog
        open={!!selectedDayModal}
        onOpenChange={(open) => !open && setSelectedDayModal(null)}
      >
        <DialogContent
          className="p-0 overflow-hidden flex flex-col"
          style={{ width: "min(680px, 92vw)", maxWidth: "min(680px, 92vw)", height: "min(560px, 80vh)" }}
        >
          {selectedDayModal && (
            <>
              {/* Modal Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center text-sm shadow-2xs">
                    {format(selectedDayModal.date, "d")}
                  </span>
                  <div>
                    <DialogTitle className="text-sm font-semibold">
                      {format(selectedDayModal.date, "EEEE, MMMM d, yyyy")}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {selectedDayModal.orders.length} scheduled production orders
                    </DialogDescription>
                  </div>
                </div>

                {/* Filter in modal */}
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Search day orders..."
                    className="h-7 text-xs pl-7 bg-background"
                  />
                </div>
              </div>

              {/* Order List inside Modal */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {modalFilteredOrders.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    No orders match your filter.
                  </div>
                ) : (
                  modalFilteredOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => {
                        handleOrderClick(order);
                        setSelectedDayModal(null);
                      }}
                      className={`p-2.5 rounded-lg border border-border/80 bg-card hover:bg-accent/20 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs border-l-4 ${getPriorityStyle(
                        order.priority
                      )}`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-xs text-foreground">
                            {order.id}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {order.department}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            • {order.machine}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-foreground truncate">
                          {order.product}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                          <span>Customer: <strong className="text-foreground">{order.customer}</strong></span>
                          <span>Qty: <strong className="text-foreground font-mono">{order.qty.toLocaleString()} {order.unit}</strong></span>
                          <span>Lead: <strong className="text-foreground">{order.responsible}</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(order.status)}
                          <span className="text-xs font-semibold">{order.status}</span>
                        </div>
                        <span className="font-mono font-semibold text-xs text-foreground">
                          ${order.priceTotal.toLocaleString()} USD
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 text-[10px] text-primary gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order);
                            setSelectedDayModal(null);
                          }}
                        >
                          <ExternalLink className="size-3" />
                          Open
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
