"use client";

import React, { useState, useMemo } from "react";
import {
  useWorkspaceStore,
  DocumentTab,
} from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  Clock,
  Printer,
  Save,
  Check,
  Cpu,
  Wrench,
  CheckCircle2,
  Layers,
  FileText,
  ArrowUpRight,
  User,
  Building2,
  Lock,
  Boxes,
  Scroll,
  Palette,
} from "lucide-react";

export interface PlanningSlotRecord {
  id: string;
  queuePos: string;
  orderType: "Production" | "Sample";
  workOrder: string;
  parentOrder: string;
  customer: string;
  product: string;
  operation: string;
  machine: string;
  shift: string;
  operator: string;
  startTime: string;
  endTime: string;
  makeReadyMin: number;
  runTimeHrs: number;
  washUpMin: number;
  plannedSheets: number;
  makeReadySheets: number;
  completedSheets: number;
  wasteSheets: number;
  paperReady: boolean;
  platesReady: boolean;
  toolingReady: boolean;
  sampleApproved: boolean;
  downtimeReason: string;
  status: string;
  colors?: string;
  spotColors?: string[];
}

const PLANT_MACHINES = [
  "Heidelberg Speedmaster XL 106-8P",
  "Komori Lithrone G40 (4-Color)",
  "Heidelberg Printmaster GTO 52",
  "Mark Andy Performance Series P7",
  "Stock Sheet-to-Sheet Kashirovka Line",
  "Bobst Novacut 106 E Autoplaten",
  "Autobond Mini 76 TH Thermal",
  "Kolbus BF 513 Hardcover Line",
  "Polar N 115 Plus High-Speed Guillotine",
  "Xerox Iridesse Digital Press",
];

export function PlanningSlotDetail({ tab }: { tab: DocumentTab }) {
  const {
    openTab,
    closeTab,
    setTabUnsaved,
    setLevel3Tab,
    addNotification,
  } = useWorkspaceStore();

  const activeTab = tab.activeLevel3Tab || "task";

  const initialRecord = useMemo<PlanningSlotRecord>(() => {
    const d = tab.documentData || {};
    return {
      id: d.id || tab.id,
      queuePos: d.queuePos || "#1",
      orderType: d.orderType === "Sample" ? "Sample" : "Production",
      workOrder: d.workOrder || "WO-00351",
      parentOrder: d.parentOrder || "CO-00041",
      customer: d.customer || "Alpha Media Group LLC",
      product: d.product || "A4 Hardcover Catalog 96p (150g Silk)",
      operation: d.operation || "1-bosqich: 4+4 CMYK Ofset Bosma",
      machine: d.machine || "Heidelberg Speedmaster XL 106-8P",
      shift: d.shift || "Day Shift (08:00–20:00)",
      operator: d.operator || "A. Kovalev (1-brigada usta-pechatnik)",
      startTime: d.startTime || `${new Date().toISOString().split("T")[0]} 08:00`,
      endTime: d.endTime || `${new Date().toISOString().split("T")[0]} 14:30`,
      makeReadyMin: Number(d.makeReadyMin) || 45,
      runTimeHrs: Number(d.runTimeHrs) || 3.5,
      washUpMin: Number(d.washUpMin) || 20,
      plannedSheets: Number(d.plannedSheets) || 12500,
      makeReadySheets: Number(d.makeReadySheets) || 150,
      completedSheets: Number(d.completedSheets) || 8400,
      wasteSheets: Number(d.wasteSheets) || 95,
      paperReady: d.paperReady !== undefined ? Boolean(d.paperReady) : true,
      platesReady: d.platesReady !== undefined ? Boolean(d.platesReady) : true,
      toolingReady: d.toolingReady !== undefined ? Boolean(d.toolingReady) : true,
      sampleApproved: d.sampleApproved !== undefined ? Boolean(d.sampleApproved) : true,
      downtimeReason: d.downtimeReason || "Yo'q (Me'yorda ishlamoqda)",
      status: d.status || "Running",
      colors: d.colors || "4+4",
      spotColors: d.spotColors || [],
    };
  }, [tab.documentData, tab.id]);

  const [form, setForm] = useState<PlanningSlotRecord>(initialRecord);

  const handleFieldChange = (field: keyof PlanningSlotRecord, val: any) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const progressPct = useMemo(() => {
    if (!form.plannedSheets || form.plannedSheets <= 0) return 0;
    return Math.min(100, Math.round((form.completedSheets / form.plannedSheets) * 100));
  }, [form.completedSheets, form.plannedSheets]);

  const remainingSheets = useMemo(() => {
    return Math.max(0, form.plannedSheets - form.completedSheets);
  }, [form.plannedSheets, form.completedSheets]);

  const readyScore = useMemo(() => {
    return (
      (form.paperReady ? 1 : 0) +
      (form.platesReady ? 1 : 0) +
      (form.toolingReady ? 1 : 0) +
      (form.sampleApproved ? 1 : 0)
    );
  }, [form.paperReady, form.platesReady, form.toolingReady, form.sampleApproved]);

  const totalAllocatedMinutes = useMemo(() => {
    return Math.round(form.makeReadyMin + form.runTimeHrs * 60 + form.washUpMin);
  }, [form.makeReadyMin, form.runTimeHrs, form.washUpMin]);

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
    addNotification({
      title: `Smena topshirig'i saqlandi: ${form.id}`,
      description: `${form.machine} (${form.shift}) — ${form.workOrder} [${form.status}]`,
      severity: "success",
    });
  };

  const handleSaveAndClose = () => {
    handleSave();
    closeTab(tab.id);
  };

  const handleOpenWorkOrder = () => {
    openTab({
      id: form.workOrder,
      title: `${form.workOrder}: ${form.product}`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: form.workOrder,
        customer: form.customer,
        product: form.product,
        department: "Offset",
        quantity: form.plannedSheets,
        unit: "sheets",
        status: "Active",
        pressMachine: form.machine,
        responsible: form.operator,
      },
    });
  };

  const handleOpenClientOrder = () => {
    openTab({
      id: form.parentOrder,
      title: `${form.parentOrder}: ${form.customer}`,
      type: "client-order",
      module: "sales",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: form.parentOrder,
        customer: form.customer,
        product: form.product,
        linkedWoId: form.workOrder,
      },
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1C Level-3 Document Workspace Header Bar */}
        <div className="px-3 bg-muted/60 border-b border-border shrink-0 flex items-center justify-between h-9 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TabsList
              variant="line"
              className="gap-1 overflow-x-auto overflow-y-hidden no-scrollbar min-w-0"
            >
              <TabsTrigger
                value="task"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Smena va Stanok Topshirig&apos;i</span>
              </TabsTrigger>
              <TabsTrigger
                value="materials"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Xomashyo va Texnik Parametrlar</span>
              </TabsTrigger>
              <TabsTrigger
                value="ticket"
                className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0"
              >
                <Scroll className="w-3.5 h-3.5" />
                <span>Marshrut Varaqasi (Наряд на печать)</span>
              </TabsTrigger>
            </TabsList>

            <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

            <Badge variant="outline" className="font-mono text-[11px] shrink-0">
              {form.id}
            </Badge>

            <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
              Navbat {form.queuePos}
            </Badge>

            <Badge
              className={
                form.status === "Running"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px]"
                  : form.status === "Delayed" || form.status === "Awaiting Sample Approval"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 text-[11px]"
                  : form.status === "Make-Ready"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[11px]"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 text-[11px]"
              }
            >
              {form.status}
            </Badge>

            <Badge
              className={
                form.orderType === "Sample"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[11px]"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-[11px]"
              }
            >
              {form.orderType === "Sample" ? "🧪 Sample Proof" : "Production Run"}
            </Badge>

            <Badge variant="outline" className="font-mono text-[11px] shrink-0 flex items-center gap-1 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
              <Palette className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>{form.colors || "4+4"}</span>
              {form.spotColors && form.spotColors.length > 0 && (
                <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-semibold">
                  +{form.spotColors.length} Spot
                </span>
              )}
            </Badge>
          </div>

          {/* 1C Standard Top-Right Action Bar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenWorkOrder}
              className="h-7 px-2.5 text-xs gap-1 font-mono cursor-pointer"
            >
              <ArrowUpRight className="w-3 h-3 text-primary" />
              <span>{form.workOrder}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenClientOrder}
              className="h-7 px-2.5 text-xs gap-1 font-mono cursor-pointer"
            >
              <ArrowUpRight className="w-3 h-3 text-primary" />
              <span>{form.parentOrder}</span>
            </Button>

            <Separator orientation="vertical" className="h-4 mx-1" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => {
                      setLevel3Tab(tab.id, "ticket");
                      if (typeof window !== "undefined") {
                        setTimeout(() => window.print(), 150);
                      }
                    }}
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                Chop etish (Marshrut varaqasi / Naryad)
              </TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAndClose}
              className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saqlash va yopish</span>
            </Button>
          </div>
        </div>

        {/* ── TAB 1: SMENA VA STANOK TOPSHIRIG'I (Full Page Dashboard) ── */}
        <TabsContent
          value="task"
          className="flex-1 overflow-y-auto p-4 space-y-4 m-0"
        >
          {/* Top KPI Status & Progress Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground font-medium">
                Stanok va Smena
              </div>
              <div className="font-semibold text-xs mt-1 truncate">
                {form.machine}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {form.shift} • {form.operator.split("(")[0]}
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground font-medium">
                Pre-Flight Tayyorgarlik
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`font-mono text-base font-bold ${
                    readyScore === 4
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {readyScore} / 4
                </span>
                <Badge
                  className={
                    readyScore === 4
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px]"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px]"
                  }
                >
                  {readyScore === 4 ? "Barcha qismlar tayyor" : "Kutilmoqda"}
                </Badge>
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                <span>Bosilgan / Reja listlar</span>
                <span className="font-mono font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="font-mono text-base font-bold mt-1">
                {form.completedSheets.toLocaleString()}{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  / {form.plannedSheets.toLocaleString()} sht
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground font-medium">
                Umumiy Normativ Vaqt
              </div>
              <div className="font-mono text-base font-bold mt-1 text-primary">
                {Math.floor(totalAllocatedMinutes / 60)}s {totalAllocatedMinutes % 60}daq
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Priladka: {form.makeReadyMin}m • Bosma: {form.runTimeHrs}s • Yuvish: {form.washUpMin}m
              </div>
            </div>
          </div>

          {/* 2-Column Spacious Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 7 Columns: Core Task Details, Machine Slot & Counter */}
            <div className="lg:col-span-7 space-y-4">
              {/* Card 1: Smena va Stanok Rekvizitlari */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    1. Stanok, Smena va Buyurtma Rekvizitlari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Mijoz (Kontragent)
                    </Label>
                    <Input
                      value={form.customer}
                      onChange={(e) => handleFieldChange("customer", e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Mahsulot Nomi
                    </Label>
                    <Input
                      value={form.product}
                      onChange={(e) => handleFieldChange("product", e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Texnologik Bosqich (Operatsiya)
                  </Label>
                  <Input
                    value={form.operation}
                    onChange={(e) => handleFieldChange("operation", e.target.value)}
                    className="h-8 text-xs bg-background font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Biriktirilgan Stanok (Machine)
                    </Label>
                    <Select
                      value={form.machine}
                      onValueChange={(v) => v && handleFieldChange("machine", v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANT_MACHINES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Smena va Navbat
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={form.queuePos}
                        onValueChange={(v) => v && handleFieldChange("queuePos", v)}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs font-mono bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="#1">Navbat #1</SelectItem>
                          <SelectItem value="#2">Navbat #2</SelectItem>
                          <SelectItem value="#3">Navbat #3</SelectItem>
                          <SelectItem value="#4">Navbat #4</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={form.shift}
                        onValueChange={(v) => v && handleFieldChange("shift", v)}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Day Shift (08:00–20:00)">
                            1-smena (08:00–20:00)
                          </SelectItem>
                          <SelectItem value="Night Shift (20:00–08:00)">
                            2-smena (20:00–08:00)
                          </SelectItem>
                          <SelectItem value="Express Run">
                            Express Run (Namuna)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-blue-600" />
                      <span>Bo&apos;yoq va Ranglar Sxemasi (Color Stations)</span>
                    </Label>
                    <div className="flex items-center gap-2 p-1.5 px-2.5 rounded border border-border bg-background">
                      <Badge variant="outline" className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 shadow-2xs">
                        {form.colors || "4+4"}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan (C)" />
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta (M)" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-2xs" title="Yellow (Y)" />
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-400 inline-block shadow-2xs" title="Key/Black (K)" />
                        {form.spotColors && form.spotColors.length > 0 && (
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow-2xs border border-white/50" title={form.spotColors.join(", ")} />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                        {form.colors?.includes("4+4") ? "8 CTP qoliplar" : form.colors?.includes("5+") ? "5 CTP qoliplar" : "4 CTP qoliplar"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Spot Pantone / Maxsus Bo&apos;yoqlar
                    </Label>
                    <Input
                      readOnly
                      value={form.spotColors && form.spotColors.length > 0 ? form.spotColors.join(", ") : "Standart CMYK (Spot yo'q)"}
                      className="h-8 text-xs bg-muted/30 font-mono text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Boshlanish vaqti
                    </Label>
                    <Input
                      value={form.startTime}
                      onChange={(e) => handleFieldChange("startTime", e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Tugash vaqti
                    </Label>
                    <Input
                      value={form.endTime}
                      onChange={(e) => handleFieldChange("endTime", e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Mas&apos;ul Pechatnik / Usta
                    </Label>
                    <Input
                      value={form.operator}
                      onChange={(e) => handleFieldChange("operator", e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Tiraj va Listlar Hisoblagichi (Plan vs Fakt) */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs uppercase tracking-wider">
                      2. Smena Tiraji va Bajarilgan Listlar (Plan vs Fakt)
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    Qolgan: {remainingSheets.toLocaleString()} sht
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Rejadagi List (Plan)
                    </Label>
                    <Input
                      type="number"
                      value={form.plannedSheets}
                      onChange={(e) =>
                        handleFieldChange("plannedSheets", Number(e.target.value) || 0)
                      }
                      className="h-8 text-xs font-mono font-semibold bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Priladka zapasi (sht)
                    </Label>
                    <Input
                      type="number"
                      value={form.makeReadySheets}
                      onChange={(e) =>
                        handleFieldChange("makeReadySheets", Number(e.target.value) || 0)
                      }
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Bosilgan List (Fakt)
                    </Label>
                    <Input
                      type="number"
                      value={form.completedSheets}
                      onChange={(e) =>
                        handleFieldChange("completedSheets", Number(e.target.value) || 0)
                      }
                      className="h-8 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">
                      Brak / Chiqindi (sht)
                    </Label>
                    <Input
                      type="number"
                      value={form.wasteSheets}
                      onChange={(e) =>
                        handleFieldChange("wasteSheets", Number(e.target.value) || 0)
                      }
                      className="h-8 text-xs font-mono text-rose-600 dark:text-rose-400 bg-background"
                    />
                  </div>
                </div>

                {/* Vaqt Me'yorlari */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-muted/50 border border-border rounded p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>🛠 Priladka (Sozlash)</span>
                      <span className="font-mono font-semibold">{form.makeReadyMin} daq</span>
                    </div>
                    <Input
                      type="number"
                      value={form.makeReadyMin}
                      onChange={(e) =>
                        handleFieldChange("makeReadyMin", Number(e.target.value) || 0)
                      }
                      className="h-7 text-xs font-mono mt-1.5 bg-background"
                    />
                  </div>

                  <div className="bg-muted/50 border border-border rounded p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>⚡ Asosiy Bosma</span>
                      <span className="font-mono font-semibold">{form.runTimeHrs} soat</span>
                    </div>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.runTimeHrs}
                      onChange={(e) =>
                        handleFieldChange("runTimeHrs", Number(e.target.value) || 0)
                      }
                      className="h-7 text-xs font-mono mt-1.5 bg-background"
                    />
                  </div>

                  <div className="bg-muted/50 border border-border rounded p-2.5">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>🧹 Yuvish (Tozalash)</span>
                      <span className="font-mono font-semibold">{form.washUpMin} daq</span>
                    </div>
                    <Input
                      type="number"
                      value={form.washUpMin}
                      onChange={(e) =>
                        handleFieldChange("washUpMin", Number(e.target.value) || 0)
                      }
                      className="h-7 text-xs font-mono mt-1.5 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Pre-Flight Checklist & Downtime Analysis */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card 3: Pre-Flight Tayyorgarlik Tekshiruvi */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs uppercase tracking-wider">
                      3. Stanok Oldi Tayyorgarligi (Pre-Flight)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px]"
                  >
                    {readyScore} / 4 Tayyor
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs">
                        1. Qog&apos;oz / Karton keltirildi
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Ombor chiqimi va gilotina kesimi tayyor
                      </div>
                    </div>
                    <Switch
                      checked={form.paperReady}
                      onCheckedChange={(v) => handleFieldChange("paperReady", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs">
                        2. CTP Bosma Plastinalar tayyor
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Prepress bo&apos;limidan 4/4 CMYK plastinalar chiqarilgan
                      </div>
                    </div>
                    <Switch
                      checked={form.platesReady}
                      onCheckedChange={(v) => handleFieldChange("platesReady", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs">
                        3. Shtansforma (`DIE`) / Klishe (`CL`)
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Osnastka stellajdan olindi va pichoqlar soz
                      </div>
                    </div>
                    <Switch
                      checked={form.toolingReady}
                      onCheckedChange={(v) => handleFieldChange("toolingReady", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-xs">
                        4. Etalon Namuna (Podpisnoy list)
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Mijoz va texnolog tomonidan imzolangan
                      </div>
                    </div>
                    <Switch
                      checked={form.sampleApproved}
                      onCheckedChange={(v) => handleFieldChange("sampleApproved", v)}
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Holat va Kechikish Sababi */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    4. Smena Holati va To&apos;xtalish Sababi
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Smena Holati (Status)
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => v && handleFieldChange("status", v)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled (Navbatda)</SelectItem>
                      <SelectItem value="Make-Ready">Make-Ready (Priladka sozlash)</SelectItem>
                      <SelectItem value="Running">Running (Bosilmoqda)</SelectItem>
                      <SelectItem value="Delayed">Delayed (To&apos;xtagan)</SelectItem>
                      <SelectItem value="Awaiting Sample Approval">
                        Awaiting Sample Approval
                      </SelectItem>
                      <SelectItem value="Completed">Completed (Yakunlandi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    Kechikish / To&apos;xtash Sababi (Downtime Reason)
                  </Label>
                  <Select
                    value={form.downtimeReason}
                    onValueChange={(v) => v && handleFieldChange("downtimeReason", v)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yo'q (Me'yorda ishlamoqda)">
                        Yo&apos;q (Me&apos;yorda ishlamoqda)
                      </SelectItem>
                      <SelectItem value="Qog'oz namligi / akklimatizatsiya kutilmoqda">
                        Qog&apos;oz namligi / akklimatizatsiya kutilmoqda
                      </SelectItem>
                      <SelectItem value="Oldingi bo'yoq qatlami qurishini kutish">
                        Oldingi bo&apos;yoq qatlami qurishini kutish
                      </SelectItem>
                      <SelectItem value="Mijoz etalon namuna tasdig'ini kutish">
                        Mijoz etalon namuna tasdig&apos;ini kutish
                      </SelectItem>
                      <SelectItem value="Shtansforma pichoqlarini ta'mirlash (Re-knifing)">
                        Shtansforma pichoqlarini ta&apos;mirlash (Re-knifing)
                      </SelectItem>
                      <SelectItem value="Stanok profilaktikasi / Mexanik sozlash">
                        Stanok profilaktikasi / Mexanik sozlash
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="h-8 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>O&apos;zgarishlarni Saqlash</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLevel3Tab(tab.id, "ticket")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Naryad</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: XOMASHYO VA TEXNIK PARAMETRLAR ── */}
        <TabsContent
          value="materials"
          className="flex-1 overflow-y-auto p-4 space-y-4 m-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Boxes className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider">
                  Bosma Qog&apos;oz / Karton
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Material:</span>
                  <span className="font-semibold">Galerie Art Silk 150g/m²</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Format:</span>
                  <span className="font-mono">700×1000 mm (B1)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Reja Miqdori:</span>
                  <span className="font-mono font-bold">{form.plannedSheets.toLocaleString()} list</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Priladka Zapasi:</span>
                  <span className="font-mono">{form.makeReadySheets} list</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    Bo&apos;yoq va CTP Qoliplar
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                  {form.colors || "4+4"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Rang sxemasi:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold">{form.colors || "4+4 CMYK Process"}</span>
                    <div className="flex items-center gap-0.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-400 inline-block" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">CTP Plastinalar:</span>
                  <span className="font-mono font-semibold">
                    {form.colors?.includes("4+4") ? "8 dona (Fuji Brillia 790×1030)" : form.colors?.includes("5+") ? "5 dona (Fuji Brillia 790×1030)" : "4 dona (Fuji Brillia 790×1030)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Spot Pantone:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {form.spotColors && form.spotColors.length > 0 ? form.spotColors.join(", ") : "Yo'q (Standart CMYK)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Bo&apos;yoq seriyasi:</span>
                  <span>Toyo Hyplus Fast-Set (Viscosity 23s)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Qoplama:</span>
                  <span>Disperssion Water-based Varnish</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Wrench className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider">
                  Post-Press Osnastka
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Shtansforma:</span>
                  <span className="font-mono">DIE-0103 (2-up Folder)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Stellaj joyi:</span>
                  <span className="font-mono">Rack B-02</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Laminatsiya plyonkasi:</span>
                  <span>Soft-Touch Matte 320mm</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Yelim turi:</span>
                  <span>PVA D3 / Hot-melt PUR</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: MARSHRUT VARAQASI (Printable Shift Ticket) ── */}
        <TabsContent
          value="ticket"
          className="flex-1 overflow-y-auto p-6 bg-zinc-100 dark:bg-zinc-950 m-0"
        >
          <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-8 shadow-sm text-zinc-900 dark:text-zinc-100 print:border-none print:shadow-none print:p-0">
            {/* Ticket Header */}
            <div className="flex items-start justify-between border-b-2 border-zinc-900 dark:border-zinc-100 pb-4">
              <div>
                <div className="text-xl font-bold uppercase tracking-wider">
                  PRINTGOO POLIGRAFIYA MAJMUASI
                </div>
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mt-0.5">
                  STANOK SMENALI TOPSHIRIG&apos;I / MARSHRUT VARAQASI № {form.id}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
                  {form.orderType === "Sample" ? "NAMUNA" : "TIRAJ BOSMA"}
                </Badge>
                <div className="text-[11px] font-mono text-zinc-500 mt-1">
                  Chop etilgan: {new Date().toISOString().split("T")[0]}
                </div>
              </div>
            </div>

            {/* Requisites Table */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-zinc-200 dark:border-zinc-800 text-xs">
              <div className="space-y-1.5">
                <div>
                  <span className="text-zinc-500">Mijoz:</span>{" "}
                  <strong>{form.customer}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Buyurtma №:</span>{" "}
                  <strong className="font-mono">{form.workOrder}</strong> (Zakaz: {form.parentOrder})
                </div>
                <div>
                  <span className="text-zinc-500">Mahsulot:</span>{" "}
                  <strong>{form.product}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Operatsiya:</span>{" "}
                  <strong>{form.operation}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Bo&apos;yoq / Seksiyalar:</span>{" "}
                  <strong className="font-mono text-blue-600 dark:text-blue-400">{form.colors || "4+4"}</strong>
                  {form.spotColors && form.spotColors.length > 0 && (
                    <span className="text-zinc-500 font-mono text-[11px]"> ({form.spotColors.join(", ")})</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-zinc-500">Stanok:</span>{" "}
                  <strong>{form.machine}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Smena:</span>{" "}
                  <strong>{form.shift}</strong> (Navbat: {form.queuePos})
                </div>
                <div>
                  <span className="text-zinc-500">Mas&apos;ul Usta:</span>{" "}
                  <strong>{form.operator}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Reja vaqti:</span>{" "}
                  <span className="font-mono">{form.startTime} — {form.endTime}</span>
                </div>
              </div>
            </div>

            {/* Plan vs Actual Matrix */}
            <div className="py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="text-xs font-bold uppercase tracking-wider mb-2">
                Tiraj va Listlar Me&apos;yori
              </div>
              <table className="w-full text-xs text-left border border-zinc-200 dark:border-zinc-800">
                <thead className="bg-zinc-100 dark:bg-zinc-800/60 font-semibold">
                  <tr>
                    <th className="p-2 border">Rejadagi List</th>
                    <th className="p-2 border">Priladka Zapasi</th>
                    <th className="p-2 border">Bosilgan (Fakt)</th>
                    <th className="p-2 border">Brak (Chiqindi)</th>
                    <th className="p-2 border">Qoldiq</th>
                    <th className="p-2 border">Bajarilish %</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr>
                    <td className="p-2 border font-bold">{form.plannedSheets.toLocaleString()}</td>
                    <td className="p-2 border">{form.makeReadySheets}</td>
                    <td className="p-2 border font-bold text-emerald-600 dark:text-emerald-400">
                      {form.completedSheets.toLocaleString()}
                    </td>
                    <td className="p-2 border text-rose-600 dark:text-rose-400">{form.wasteSheets}</td>
                    <td className="p-2 border">{remainingSheets.toLocaleString()}</td>
                    <td className="p-2 border font-bold">{progressPct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Hourly Log for Pressman (Manual Entry Table) */}
            <div className="py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="text-xs font-bold uppercase tracking-wider mb-2">
                Pechatnikning Soatbay Hisobot Jadvali (Stanok Hisoblagichi)
              </div>
              <table className="w-full text-[11px] text-left border border-zinc-200 dark:border-zinc-800">
                <thead className="bg-zinc-100 dark:bg-zinc-800/60 font-semibold">
                  <tr>
                    <th className="p-1.5 border w-16">Soat</th>
                    <th className="p-1.5 border">Hisoblagich (List)</th>
                    <th className="p-1.5 border">1 Soatlik Tezlik</th>
                    <th className="p-1.5 border">Brak (List)</th>
                    <th className="p-1.5 border">Holat / To&apos;xtalish Sababi</th>
                    <th className="p-1.5 border w-24">Pechatnik Imzosi</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((row) => (
                    <tr key={row} className="h-7">
                      <td className="p-1.5 border font-mono text-center">{row}-soat</td>
                      <td className="p-1.5 border"></td>
                      <td className="p-1.5 border"></td>
                      <td className="p-1.5 border"></td>
                      <td className="p-1.5 border"></td>
                      <td className="p-1.5 border"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-3 gap-6 pt-6 text-xs">
              <div className="space-y-6">
                <div>Smena Ustasi (Pechatnik):</div>
                <div className="border-b border-zinc-400 w-full"></div>
              </div>
              <div className="space-y-6">
                <div>Smena Nazoratchisi (ОТК):</div>
                <div className="border-b border-zinc-400 w-full"></div>
              </div>
              <div className="space-y-6">
                <div>Bosh Dispetcher:</div>
                <div className="border-b border-zinc-400 w-full"></div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
