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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import {
  Plus,
  Sparkles,
  Layers,
  CheckSquare,
  Wrench,
  ShieldCheck,
  Briefcase,
  User,
  Clock,
  Calendar,
  AlertCircle,
  Trash2,
  Printer,
  Check,
  FileText,
  Sunrise,
  Sunset,
  Moon,
  RotateCw,
  Cpu,
  Building2,
  ShoppingCart,
} from "lucide-react";
import { useTaskStore, TaskRoleCategory, TaskPriority } from "@/store/taskStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

// ─── Combobox Master Data with Lucide Icons (NO EMOJIS) ─────────────────────

export const ASSIGNEE_COMBOBOX_OPTIONS: ComboboxItem[] = [
  { value: "Alexey Kovalev", label: "Alexey Kovalev", description: "Production Shift Lead • Lead Supervisor", badge: "Management", icon: User },
  { value: "Dmitry Morozov", label: "Dmitry Morozov", description: "System Administrator • Operations & IT", badge: "Admin", icon: ShieldCheck },
  { value: "Elena Voronina", label: "Elena Voronina", description: "Commercial & Sales Director • VIP Clients", badge: "Commercial", icon: Briefcase },
  { value: "K. Anderson (Prepress)", label: "K. Anderson", description: "Prepress Lead • CTP & Color Management", badge: "Prepress", icon: Wrench },
  { value: "M. Ivanova (Press)", label: "M. Ivanova", description: "Lead Pressman • Heidelberg Speedmaster XL 106", badge: "Press", icon: Printer },
  { value: "A. Becker (Lamination)", label: "A. Becker", description: "Finishing Specialist • Thermal & Soft-touch", badge: "Finishing", icon: Layers },
  { value: "S. Petrov (Die-cut)", label: "S. Petrov", description: "Die-cutting Operator • Bobst Novacut 106", badge: "Finishing", icon: Wrench },
  { value: "T. Smirnov (Warehouse)", label: "T. Smirnov", description: "Warehouse Specialist • Paper Substrates", badge: "Logistics", icon: Building2 },
  { value: "N. Fedorov (Packaging)", label: "N. Fedorov", description: "Packaging & Dispatch Specialist", badge: "Shipping", icon: CheckSquare },
  { value: "Prepress Dept", label: "Prepress Dept", description: "Prepress Floor Queue", badge: "Department", icon: Wrench },
  { value: "Press Dept", label: "Press Dept", description: "Press Operations Queue", badge: "Department", icon: Printer },
  { value: "Finishing Dept", label: "Finishing Dept", description: "Post-Press & Binding Queue", badge: "Department", icon: Layers },
  { value: "Warehouse Dept", label: "Warehouse Dept", description: "Material & Logistics Queue", badge: "Department", icon: Building2 },
];

export const ERP_ENTITY_COMBOBOX_OPTIONS: Record<string, ComboboxItem[]> = {
  "work-order": [
    { value: "WOOF-26-0351", label: "WOOF-26-0351", description: "A4 Hardcover Catalog 96p • Alpha Media Group", badge: "Active", icon: FileText },
    { value: "WOOF-26-0352", label: "WOOF-26-0352", description: "Retail Folded Brochures • Nordic Print Co", badge: "Planning", icon: FileText },
    { value: "WOFL-26-0355", label: "WOFL-26-0355", description: "Self-Adhesive Wine Bottle Labels • Apex Packaging", badge: "Active", icon: FileText },
    { value: "WOOF-26-0358", label: "WOOF-26-0358", description: "Cardboard Packaging Sleeves • MegaCorp", badge: "Queue", icon: FileText },
    { value: "WOOF-26-0360", label: "WOOF-26-0360", description: "Luxury Embossed Cosmetic Boxes • Velvet Line", badge: "Prepress", icon: FileText },
    { value: "WOJC-26-0362", label: "WOJC-26-0362", description: "Quarterly Magazine 128p • Capital Publishing", badge: "Proofing", icon: FileText },
  ],
  "client-order": [
    { value: "CO-00041", label: "CO-00041", description: "Alpha Media Group — 5,000 Hardcover Catalogs", badge: "Confirmed", icon: ShoppingCart },
    { value: "CO-00042", label: "CO-00042", description: "Nordic Print Co — Seasonal Promotion Leaflets", badge: "In Production", icon: ShoppingCart },
    { value: "CO-00043", label: "CO-00043", description: "MegaCorp — 10,000 Folding Cartons", badge: "Approved", icon: ShoppingCart },
    { value: "CO-00044", label: "CO-00044", description: "Baltic Press — Corporate Magazine Reprint", badge: "Pending Prep", icon: ShoppingCart },
  ],
  "machine": [
    { value: "MCH-01", label: "MCH-01", description: "Heidelberg Speedmaster XL 106 (Offset Press)", badge: "Press Floor", icon: Cpu },
    { value: "MCH-02", label: "MCH-02", description: "Mark Andy Performance Series P7 (Flexo Press)", badge: "Flexo Floor", icon: Cpu },
    { value: "MCH-03", label: "MCH-03", description: "HP Indigo 12000 HD (Digital Press)", badge: "Digital Floor", icon: Cpu },
    { value: "MCH-04", label: "MCH-04", description: "Bobst Novacut 106 E (Die-Cutter)", badge: "Finishing", icon: Cpu },
    { value: "MCH-05", label: "MCH-05", description: "Horizon BQ-480 PUR (Perfect Binder)", badge: "Binding", icon: Cpu },
    { value: "MCH-06", label: "MCH-06", description: "MBO K800 Combination Folder", badge: "Folding", icon: Cpu },
  ],
  "customer": [
    { value: "CST-1001", label: "CST-1001", description: "Nordic Print Co • Account Manager: E. Voronina", badge: "Key Client", icon: Building2 },
    { value: "CST-1002", label: "CST-1002", description: "Baltic Press LLC • Account Manager: E. Voronina", badge: "Publishing", icon: Building2 },
    { value: "CST-1003", label: "CST-1003", description: "Alpha Media Group LLC • Corporate Publishing", badge: "VIP", icon: Building2 },
    { value: "CST-1004", label: "CST-1004", description: "Apex Packaging Solutions • FMCG Packaging", badge: "Manufacturing", icon: Building2 },
    { value: "CST-1005", label: "CST-1005", description: "MegaCorp Industries • Retail & Consumer", badge: "Enterprise", icon: Building2 },
  ],
};

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

const TEMPLATE_COMBOBOX_OPTIONS: ComboboxItem[] = [
  { value: "pressCheck", label: "Press Calibration & Doctor Blade Check", description: "Offset unit clean, pH check & blade micrometer inspection", badge: "Operator", icon: Printer },
  { value: "proofApproval", label: "Color Proof Deviation Sign-off", description: "Spectrophotometer Delta-E tolerance review & press approval", badge: "Manager", icon: ShieldCheck },
  { value: "stockVerification", label: "Paper Shortage Warehouse Audit", description: "Physical pallet count in bay A3-12 vs 1C ledger discrepancy", badge: "Manager", icon: Layers },
  { value: "quoteFollowup", label: "Commercial Quotation Follow-up", description: "Call client procurement lead regarding volume tier discount", badge: "CRM", icon: Briefcase },
  { value: "plateCheck", label: "Prepress CTP Plate Verification", description: "Laser exposure dot percentages and plate notch inspection", badge: "Operator", icon: FileText },
];

const ENTITY_TYPE_OPTIONS: ComboboxItem[] = [
  { value: "work-order", label: "Work Order (WO)", description: "Shop floor manufacturing job", badge: "Production", icon: FileText },
  { value: "client-order", label: "Client Order (CO)", description: "Customer commercial order", badge: "Sales", icon: ShoppingCart },
  { value: "machine", label: "Machine / Equipment", description: "Presses, die-cutters, binders", badge: "Master Data", icon: Cpu },
  { value: "customer", label: "Customer Account", description: "Client profile & CRM account", badge: "CRM", icon: Building2 },
  { value: "general", label: "General / Standalone", description: "No specific linked entity", badge: "General", icon: Layers },
];

export function CreateTaskModal() {
  const t = useTranslations("Tasks");
  const tCommon = useTranslations("Common");
  const { isCreateModalOpen, setCreateModalOpen, addTask, selectTask } = useTaskStore();
  const { currentUser } = useWorkspaceStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleCategory, setRoleCategory] = useState<TaskRoleCategory>("operator");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState<string>("Alexey Kovalev");
  const [shift, setShift] = useState<"Morning" | "Evening" | "Night" | "All">("Morning");
  const [dueDate, setDueDate] = useState("2026-10-06");
  const [dueTime, setDueTime] = useState("16:00");
  
  // Linked ERP entity
  const [relatedType, setRelatedType] = useState<"work-order" | "client-order" | "machine" | "customer" | "general">("work-order");
  const [selectedEntityId, setSelectedEntityId] = useState("WOOF-26-0351");

  // Initial checklist items
  const [checklistItems, setChecklistItems] = useState<string[]>([
    "Initial technical inspection and safety clearance",
    "Perform required steps in compliance with standard",
  ]);
  const [newChecklistInput, setNewChecklistInput] = useState("");

  const getSelectedEntityName = () => {
    if (relatedType === "general") return undefined;
    const list = ERP_ENTITY_COMBOBOX_OPTIONS[relatedType] || [];
    const found = list.find((item) => item.value === selectedEntityId);
    return found ? found.description : undefined;
  };

  const applyTemplate = (templateKey: string) => {
    switch (templateKey) {
      case "pressCheck":
        setTitle(t("templatePressCheck"));
        setDescription("Inspect doctor blades, clean ink fountain trays, verify fountain solution pH and conductivity (1200 µS) on Speedmaster XL 106 before production run starts.");
        setRoleCategory("operator");
        setPriority("high");
        setAssignedTo("M. Ivanova (Press)");
        setShift("Morning");
        setRelatedType("machine");
        setSelectedEntityId("MCH-01");
        setChecklistItems([
          "Measure doctor blade edge wear with micrometer",
          "Drain and flush fountain solution trays",
          "Test registration balance at 15,000 imp/hr",
        ]);
        break;
      case "proofApproval":
        setTitle(t("templateProofApproval"));
        setDescription("Review customer signed color proof with spectrophotometer Delta-E readings on Spot UV and Pantone ink sections.");
        setRoleCategory("manager");
        setPriority("urgent");
        setAssignedTo("Alexey Kovalev");
        setShift("Morning");
        setRelatedType("work-order");
        setSelectedEntityId("WOOF-26-0351");
        setChecklistItems([
          "Check Delta-E values on CMYK and PMS 871 patches",
          "Confirm client signed physical sheet vs digital PDF",
          "Sign production release approval ticket",
        ]);
        break;
      case "stockVerification":
        setTitle(t("templateStockVerification"));
        setDescription("Audit physical stock in warehouse bay A3-12 due to discrepancy in scheduled run sheet. Verify pallet batch numbers.");
        setRoleCategory("manager");
        setPriority("urgent");
        setAssignedTo("Dmitry Morozov");
        setShift("Morning");
        setRelatedType("work-order");
        setSelectedEntityId("WOOF-26-0351");
        setChecklistItems([
          "Physical count of reams in pallet rack A3-12",
          "Cross-reference barcode in 1C Warehouse Registry",
          "Authorize substitution or submit emergency purchase ticket",
        ]);
        break;
      case "quoteFollowup":
        setTitle(t("templateQuoteFollowup"));
        setDescription("Phone client procurement director regarding discounted pricing tier for bulk orders (10k+ volume).");
        setRoleCategory("general");
        setPriority("normal");
        setAssignedTo("Elena Voronina");
        setShift("All");
        setRelatedType("customer");
        setSelectedEntityId("CST-1001");
        setChecklistItems([
          "Review quotation cost margin in Pre-Sales module",
          "Call procurement director and discuss delivery schedule",
          "Log conversation outcome in CRM Activity notes",
        ]);
        break;
      case "plateCheck":
        setTitle(t("templatePlateCheck"));
        setDescription("Verify CTP laser exposure resolution and linearisation calibration dots at 2400 dpi before mounting.");
        setRoleCategory("operator");
        setPriority("high");
        setAssignedTo("K. Anderson (Prepress)");
        setShift("Morning");
        setRelatedType("work-order");
        setSelectedEntityId("WOOF-26-0351");
        setChecklistItems([
          "Inspect dot percentage on 25%, 50%, 75% control strips",
          "Verify plate notch alignment and zero scratch defects",
        ]);
        break;
    }
  };

  const handleAddChecklist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChecklistInput.trim()) return;
    setChecklistItems((prev) => [...prev, newChecklistInput.trim()]);
    setNewChecklistInput("");
  };

  const handleRemoveChecklist = (idx: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    const fullDueDate = `${dueDate} ${dueTime}`;
    const entityName = getSelectedEntityName();

    const created = addTask({
      title: title.trim(),
      description: description.trim(),
      roleCategory,
      status: "pending",
      priority,
      assignedTo,
      assignedBy: currentUser.name,
      dueDate: fullDueDate,
      shift,
      relatedType,
      relatedId: relatedType === "general" ? undefined : selectedEntityId,
      relatedName: entityName,
      checklist: checklistItems.map((text, i) => ({
        id: `c_${Date.now()}_${i}`,
        text,
        completed: false,
      })),
    });

    setCreateModalOpen(false);
    selectTask(created.id);
  };

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <CheckSquare className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground">
                  {t("createTitle")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {t("subtitle")}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-6">
              <Badge variant="outline" className="text-[11px] font-mono font-medium px-2 py-0.5">
                1C:ERP Document
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Task Template Combobox Toolbar */}
        <div className="bg-muted/30 px-5 py-1.5 border-b border-border/80 flex items-center justify-between gap-3 select-none shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>{t("quickTemplates")}:</span>
            </span>
            <div className="flex-1">
              <SmartCombobox
                options={TEMPLATE_COMBOBOX_OPTIONS}
                placeholder="Select or search a preset template..."
                searchPlaceholder="Search template (Press, Proof, Shortage)..."
                allowCustom={false}
                onChange={(val) => applyTemplate(val)}
                className="h-7 text-xs bg-background"
                popoverWidth="w-[380px]"
              />
            </div>
          </div>

          <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
            Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border">Ins</kbd> to create
          </span>
        </div>

        {/* 2-Column Balanced Body */}
        <form onSubmit={handleCreate} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* ── Left Column: Primary Content (7 cols) ── */}
            <div className="md:col-span-7 space-y-4">
              {/* Task Title */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  {t("fieldTitle")} <span className="text-destructive">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inspect doctor blades and clean fountain solution trays on Heidelberg press"
                  className="h-9 text-xs font-medium bg-background px-3 shadow-xs"
                  autoFocus
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  {t("fieldDescription")}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide clear technical, quality or operational instructions and expected tolerances..."
                  className="text-xs resize-none min-h-[100px] bg-background p-2.5 leading-relaxed shadow-xs"
                />
              </div>

              {/* Checklist / Subtasks */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckSquare className="size-3.5 text-primary" />
                    <span>{t("checklistTitle")}</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {checklistItems.length} steps configured
                  </span>
                </div>

                <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-muted/20">
                  {checklistItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-md text-xs bg-background border border-border/60 shadow-2xs group"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="size-4.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-foreground">{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklist(idx)}
                        className="size-5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add Checklist Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newChecklistInput}
                      onChange={(e) => setNewChecklistInput(e.target.value)}
                      placeholder={t("checklistPlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddChecklist();
                        }
                      }}
                      className="h-7 text-xs bg-background"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddChecklist}
                      className="h-7 px-2.5 text-xs shrink-0 font-medium"
                    >
                      <Plus className="size-3 mr-1" />
                      {tCommon("create")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column: Meta & Inspector (5 cols) ── */}
            <div className="md:col-span-5 space-y-3 bg-muted/20 p-4 rounded-xl border border-border/80">
              {/* Target Role / Category (Combobox with Lucide icon) */}
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1">
                  {t("fieldCategory")} <span className="text-destructive">*</span>
                </label>
                <SmartCombobox
                  value={roleCategory}
                  onChange={(v) => setRoleCategory(v as TaskRoleCategory)}
                  options={CATEGORY_COMBOBOX_OPTIONS}
                  placeholder="Select category..."
                  searchPlaceholder="Search category..."
                  allowCustom={false}
                  className="h-8 text-xs bg-background"
                  popoverWidth="w-[320px]"
                />
              </div>

              {/* Priority Selector (Clean Lucide color dots) */}
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1">
                  {t("fieldPriority")}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "urgent", label: t("priorityUrgent"), color: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300", dot: "bg-red-500" },
                    { id: "high", label: t("priorityHigh"), color: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300", dot: "bg-amber-500" },
                    { id: "normal", label: t("priorityNormal"), color: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300", dot: "bg-blue-500" },
                    { id: "low", label: t("priorityLow"), color: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id as TaskPriority)}
                      className={cn(
                        "flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer",
                        priority === p.id ? `${p.color} ring-1 ring-primary/40 font-bold shadow-xs` : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", p.dot)} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee (Searchable Combobox) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    {t("fieldAssignee")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAssignedTo(currentUser.name)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <User className="size-3" />
                    {t("assignToMe")}
                  </button>
                </div>
                <SmartCombobox
                  value={assignedTo}
                  onChange={setAssignedTo}
                  options={ASSIGNEE_COMBOBOX_OPTIONS}
                  placeholder="Select or search assignee..."
                  searchPlaceholder="Search operator, manager, or queue..."
                  allowCustom={true}
                  className="h-8 text-xs bg-background"
                  popoverWidth="w-[340px]"
                />
              </div>

              {/* Schedule: DatePicker, Time, Shift Combobox with Lucide Shift Icons */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      {t("fieldDueDate")}
                    </label>
                    <DatePicker
                      value={dueDate}
                      onChange={(val) => setDueDate(val || "2026-10-06")}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      {t("timeLabel")}
                    </label>
                    <Input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                    {t("fieldShift")}
                  </label>
                  <SmartCombobox
                    value={shift}
                    onChange={(v) => setShift(v as any)}
                    options={SHIFT_COMBOBOX_OPTIONS}
                    placeholder="Select shift..."
                    searchPlaceholder="Search shift..."
                    allowCustom={false}
                    className="h-8 text-xs bg-background"
                    popoverWidth="w-[280px]"
                  />
                </div>
              </div>

              {/* Linked ERP Entity (Searchable Combobox) */}
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-3 text-blue-600 dark:text-blue-400" />
                  <span>{t("linkedEntityTitle")}</span>
                </label>

                <div className="space-y-1.5">
                  <SmartCombobox
                    value={relatedType}
                    onChange={(v) => {
                      setRelatedType(v as any);
                      if (v !== "general") {
                        const list = ERP_ENTITY_COMBOBOX_OPTIONS[v] || [];
                        if (list[0]) setSelectedEntityId(list[0].value);
                      }
                    }}
                    options={ENTITY_TYPE_OPTIONS}
                    placeholder="Select entity type..."
                    searchPlaceholder="Search entity type..."
                    allowCustom={false}
                    className="h-8 text-xs bg-background"
                    popoverWidth="w-[280px]"
                  />

                  {relatedType !== "general" && (
                    <SmartCombobox
                      value={selectedEntityId}
                      onChange={setSelectedEntityId}
                      options={ERP_ENTITY_COMBOBOX_OPTIONS[relatedType] || []}
                      placeholder={t("entityPlaceholder")}
                      searchPlaceholder={`Search ${relatedType} by code, name, description...`}
                      allowCustom={true}
                      className="h-8 text-xs bg-background"
                      popoverWidth="w-[380px]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="m-0 sm:m-0 px-6 py-3 border-t border-border bg-muted/40 flex items-center justify-end gap-3 shrink-0 rounded-b-xl">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="h-8 px-4 text-xs"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="h-8 px-5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              disabled={!title.trim()}
            >
              <Plus className="size-3.5 mr-1.5" />
              {t("saveAndClose")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
