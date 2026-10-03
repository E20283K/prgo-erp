"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Boxes,
  Factory,
  Clock,
  History,
  Printer,
  Save,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid";

import {
  WorkOrderFormData,
  OrderAttachment,
  RouteStep,
  ShiftEvent,
  MASTER_SPECIFICATIONS,
  SITE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  MACHINE_OPTIONS,
  RECIPE_MATERIALS,
  MACHINE_MAP,
  getInitialOperations,
} from "./types";
import { EXAMPLE_ATTACHMENTS } from "@/components/file-viewer/file-utils";
import { OverviewTab } from "./tabs/OverviewTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { ShiftTimelineTab } from "./tabs/ShiftTimelineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { OperationDialog } from "./dialogs/OperationDialog";
import { LogEventDialog } from "./dialogs/LogEventDialog";

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const { setTabUnsaved, closeTab, setLevel3Tab, theme, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  const [formData, setFormData] = useState<WorkOrderFormData>({
    customer: data.customer || "Alpha Media Group",
    product: data.product || "A4 Catalog 96 pages",
    department: data.department || "Offset",
    site: data.site || "Building 1",
    recipe: data.recipe || (data.department === "Flexo" ? "FLEXO_NYLON_V1" : data.department === "Jacquard" ? "JACQ_WOVEN_V1" : "OFFSET_STD_V1"),
    quantity: data.quantity || 5000,
    unit: data.unit || "pcs",
    status: data.status || "Active",
    priority: data.priority || "High",
    pressMachine: data.pressMachine || "Heidelberg Speedmaster XL 106",
    startDate: data.startDate || "2026-09-30",
    deadline: data.deadline || "2026-10-06",
    paperStock: data.paperStock || "Galerie Art Silk 150g/m²",
    coating: data.coating || "Soft-Touch Matte + Spot UV",
    priceTotal: data.priceTotal || 14850.0,
    currency: data.currency || "USD",
    photoUrl: data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    itemCategory: data.itemCategory || "Hangtag",
    width: data.width || 50,
    height: data.height || 90,
    dimensionUnit: data.dimensionUnit || "mm",
    cornerType: data.cornerType || "Square",
    bleed: data.bleed || 2,
    sizes: data.sizes || [
      { id: "1", size: "S", quantity: 1500 },
      { id: "2", size: "M", quantity: 2000 },
      { id: "3", size: "L", quantity: 1500 },
    ],
    milestones: data.milestones || [
      { id: "m1", name: "Preflight File", department: "Prepress", status: "Done", assignedTo: "Prepress Dept" },
      { id: "m2", name: "Materials", department: "Warehouse", status: "Done", assignedTo: "Warehouse Dept" },
      { id: "m3", name: "CTP Plates", department: "Prepress", status: "In Progress", assignedTo: "K. Anderson (Prepress)" },
      { id: "m4", name: "Printing", department: "Offset", status: "Pending", assignedTo: "Press Dept" },
      { id: "m5", name: "Post-press", department: "Finishing", status: "Pending", assignedTo: "Finishing Dept" }
    ],
  });

  const [orderAttachments, setOrderAttachments] = useState<OrderAttachment[]>(
    data.attachments || EXAMPLE_ATTACHMENTS
  );

  // Operations Route State
  const [operations, setOperations] = useState<RouteStep[]>(
    getInitialOperations(formData.recipe, formData.pressMachine, formData.department, formData.quantity)
  );

  React.useEffect(() => {
    if (formData.recipe) {
      setOperations(getInitialOperations(formData.recipe, formData.pressMachine, formData.department, formData.quantity));
    }
  }, [formData.recipe, formData.pressMachine, formData.department, formData.quantity]);

  const [opSelection, setOpSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [editingOpIndex, setEditingOpIndex] = useState<number | null>(null);
  const [opDialogForm, setOpDialogForm] = useState<Omit<RouteStep, "id">>({
    stepNumber: 10,
    name: "",
    machine: formData.pressMachine,
    operator: "K. Anderson",
    duration: 1,
    qtyCompleted: "0 / 5,000",
    status: "Queued",
  });

  // Shift Timeline & Log Events State
  const [selectedTimelineOpId, setSelectedTimelineOpId] = useState<string>("2");
  const [shiftEvents, setShiftEvents] = useState<ShiftEvent[]>([
    { id: "e1", opId: "1", time: "13:30", type: "Setup", note: "Plate imaging RIP calibration and density check", operator: "K. Anderson" },
    { id: "e2", opId: "1", time: "13:55", type: "Run", note: "Laser exposure and automated plate chemical rinse completed", operator: "K. Anderson" },
    { id: "e3", opId: "2", time: "14:00", type: "Setup", note: "Machine setup & plates loaded", operator: "M. Ivanova" },
    { id: "e4", opId: "2", time: "14:15", type: "Delay", note: "Waiting for paper delivery from warehouse", operator: "M. Ivanova" },
    { id: "e5", opId: "2", time: "14:40", type: "Run", note: "Print run started", operator: "M. Ivanova" },
    { id: "e6", opId: "3", time: "16:00", type: "Setup", note: "Heating thermal lamination rollers to 115°C", operator: "A. Becker" },
    { id: "e7", opId: "4", time: "17:15", type: "Setup", note: "Die matrix mounting and pressure alignment", operator: "S. Petrov" },
  ]);

  const [isLogEventDialogOpen, setIsLogEventDialogOpen] = useState(false);
  const [logEventForm, setLogEventForm] = useState<{
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC";
    note: string;
    time: string;
  }>({
    type: "Run",
    note: "",
    time: "15:30",
  });

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Derived Values
  const activeSpec = useMemo(
    () => MASTER_SPECIFICATIONS.find((s) => s.code === formData.recipe),
    [formData.recipe]
  );
  const activeSite = useMemo(
    () => SITE_OPTIONS.find((s) => s.id === formData.site || s.name === formData.site) || SITE_OPTIONS[0],
    [formData.site]
  );
  const activeTech = useMemo(
    () => TECHNOLOGY_OPTIONS.find((t) => t.id === formData.department) || TECHNOLOGY_OPTIONS[0],
    [formData.department]
  );
  const activeMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.name === formData.pressMachine || m.code === formData.pressMachine),
    [formData.pressMachine]
  );
  const currentDeptMachines = useMemo(
    () => MACHINE_OPTIONS.filter((m) => m.department === formData.department),
    [formData.department]
  );

  const currentRecipeMaterials = RECIPE_MATERIALS[formData.recipe] || [];
  const hasShortage = currentRecipeMaterials.some((m) => m.req > m.stock);

  const selectedOp = useMemo(() => {
    return operations.find((op) => op.id === selectedTimelineOpId) || operations[0] || {
      id: "1",
      stepNumber: 10,
      name: "Operation",
      machine: formData.pressMachine,
      operator: "K. Anderson",
      duration: 2.5,
      qtyCompleted: "0 / 5,000",
      status: "In Progress" as const,
    };
  }, [operations, selectedTimelineOpId, formData.pressMachine]);

  const selectedOpEvents = useMemo(() => {
    return shiftEvents.filter((ev) => ev.opId === selectedOp.id);
  }, [shiftEvents, selectedOp.id]);

  // Actions
  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleDepartmentChange = (newDept: string) => {
    const defaultRecipe = newDept === "Flexo" ? "FLEXO_NYLON_V1" : newDept === "Jacquard" ? "JACQ_WOVEN_V1" : newDept === "Post-press" ? "POST_GENERIC_V1" : "OFFSET_STD_V1";
    const available = MACHINE_MAP[newDept] || [];
    const defaultMachine = available[0] || formData.pressMachine;
    setFormData((prev) => ({
      ...prev,
      department: newDept as any,
      recipe: defaultRecipe,
      pressMachine: defaultMachine,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
  };

  const handleSaveAndClose = () => {
    setTabUnsaved(tab.id, false);
    closeTab(tab.id);
  };

  // Operation Dialog Handlers
  const handleOpenAddOperation = () => {
    setEditingOpIndex(null);
    const nextStepNum = (operations.length + 1) * 10;
    setOpDialogForm({
      stepNumber: nextStepNum,
      name: "",
      machine: formData.pressMachine || "Heidelberg Speedmaster XL 106",
      operator: "K. Anderson",
      duration: 1,
      qtyCompleted: `0 / ${(formData.quantity || 5000).toLocaleString()}`,
      status: "Queued",
    });
    setIsOpDialogOpen(true);
  };

  const handleOpenEditOperation = (index: number) => {
    const item = operations[index];
    if (!item) return;
    setEditingOpIndex(index);
    setOpDialogForm({
      stepNumber: item.stepNumber,
      name: item.name,
      machine: item.machine,
      operator: item.operator,
      duration: item.duration,
      qtyCompleted: item.qtyCompleted,
      status: item.status,
    });
    setIsOpDialogOpen(true);
  };

  const handleSaveOperationDialog = () => {
    if (editingOpIndex !== null) {
      const updated = [...operations];
      updated[editingOpIndex] = {
        ...updated[editingOpIndex],
        ...opDialogForm,
      };
      setOperations(updated);
    } else {
      setOperations([
        ...operations,
        {
          id: String(Date.now()),
          ...opDialogForm,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsOpDialogOpen(false);
  };

  const handleDeleteSelectedOperation = () => {
    const selectedRows = opSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = operations.filter((_, idx) => !selectedRows.includes(idx));
    setOperations(remaining);
    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // Log Event Dialog Handlers
  const handleOpenLogEvent = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setLogEventForm({
      type: "Run",
      note: "",
      time: `${hours}:${minutes}`,
    });
    setIsLogEventDialogOpen(true);
  };

  const handleSaveLogEvent = () => {
    if (!logEventForm.note.trim()) return;
    const newEvent: ShiftEvent = {
      id: "e_" + Date.now(),
      opId: selectedOp.id,
      time: logEventForm.time || "15:30",
      type: logEventForm.type,
      note: logEventForm.note.trim(),
      operator: selectedOp.operator,
    };
    setShiftEvents((prev) => [newEvent, ...prev]);
    setIsLogEventDialogOpen(false);
  };

  const activeTab = tab.activeLevel3Tab || "overview";

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      {/* Level 3 Tabs Navigation & Document Actions Bar */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList variant="line" className="gap-2 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger
              value="overview"
              className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>{tOrder("tabOverview")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="materials"
              className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0"
            >
              <Boxes className="w-4 h-4" />
              <span>{tOrder("tabMaterials")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="operations"
              className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0"
            >
              <Factory className="w-4 h-4" />
              <span>{tOrder("tabOperations")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="timeline"
              className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0"
            >
              <Clock className="w-4 h-4" />
              <span>{tOrder("tabTimeline")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0"
            >
              <History className="w-4 h-4" />
              <span>{tOrder("tabHistory")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-300 rounded cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tOrder("printSpec")}</span>
            </Button>

            <Button
              onClick={handleSave}
              variant="outline"
              size="sm"
              className="h-7 border-zinc-300 dark:border-zinc-700 text-xs font-medium gap-1.5 rounded cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>{tOrder("save")}</span>
            </Button>

            <Button
              onClick={handleSaveAndClose}
              size="sm"
              className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{tOrder("postAndClose")}</span>
            </Button>
          </div>
        </div>

        {/* Tab 1: Overview */}
        <OverviewTab
          formData={formData}
          handleFieldChange={handleFieldChange}
          handleDepartmentChange={handleDepartmentChange}
          data={data}
          tabId={tab.id}
          activeSpec={activeSpec}
          activeSite={activeSite}
          activeTech={activeTech}
          activeMachine={activeMachine}
          currentDeptMachines={currentDeptMachines}
          currentRecipeMaterials={currentRecipeMaterials}
          hasShortage={hasShortage}
          orderAttachments={orderAttachments}
          setOrderAttachments={setOrderAttachments}
          onOpenLightbox={() => setIsLightboxOpen(true)}
          onOpenTab={openTab}
          onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
          onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
          tOrder={tOrder}
        />

        {/* Tab 2: Materials BOM */}
        <MaterialsTab tabId={tab.id} department={formData.department} />

        {/* Tab 3: Technological Route */}
        <OperationsTab
          operations={operations}
          setOperations={setOperations}
          opSelection={opSelection}
          setOpSelection={setOpSelection}
          onOpenAddOperation={handleOpenAddOperation}
          onOpenEditOperation={handleOpenEditOperation}
          onDeleteSelectedOperation={handleDeleteSelectedOperation}
          isDark={isDark}
          onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
        />

        {/* Tab 4: Shift Timeline */}
        <ShiftTimelineTab
          operations={operations}
          selectedTimelineOpId={selectedTimelineOpId}
          setSelectedTimelineOpId={setSelectedTimelineOpId}
          selectedOp={selectedOp}
          selectedOpEvents={selectedOpEvents}
          onOpenLogEvent={handleOpenLogEvent}
        />

        {/* Tab 5: History */}
        <HistoryTab />
      </Tabs>

      {/* Dialog: Routing Operation */}
      <OperationDialog
        isOpen={isOpDialogOpen}
        onOpenChange={setIsOpDialogOpen}
        editingOpIndex={editingOpIndex}
        form={opDialogForm}
        setForm={setOpDialogForm}
        onSave={handleSaveOperationDialog}
      />

      {/* Dialog: Shift Downtime Event */}
      <LogEventDialog
        isOpen={isLogEventDialogOpen}
        onOpenChange={setIsLogEventDialogOpen}
        selectedOp={selectedOp}
        form={logEventForm}
        setForm={setLogEventForm}
        onSave={handleSaveLogEvent}
      />

      {/* Lightbox for Sample Proof */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={formData.photoUrl}
        alt={formData.product || "Sample Proof"}
        title={`${tab.documentData?.docNo || tab.id}: Sample Proof`}
        subtitle={`${formData.product} • ${formData.customer} (${formData.department})`}
      />
    </div>
  );
}
