"use client";

import React, { useState, useMemo } from "react";
import { cn } from "cn";
import {
  FileText,
  Boxes,
  Factory,
  Clock,
  History,
  Printer,
  Save,
  Check,
  Receipt,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  Cpu,
  Layers,
  Ruler,
  Paperclip,
  LayoutTemplate,
  Disc,
  Package,
  FlaskConical,
  X,
  RotateCw,
  MoreVertical,
  BookmarkPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DocumentHeader,
  HeaderIconAction,
  DocumentSidebar,
  SidebarSummaryCard,
  SidebarSectionTitle,
  InfoRow,
  formatMoney,
} from "../common/DocumentShell";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid";

import {
  WorkOrderFormData,
  WorkOrderSampleData,
  SampleRevisionRecord,
  SizeDistribution,
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
import { SpecificationsTab } from "./tabs/SpecificationsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { ShiftTimelineTab } from "./tabs/ShiftTimelineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { FinancialsTab } from "./tabs/FinancialsTab";
import { FilesTab } from "../common/FilesTab";
import { LayoutCalcTab } from "./tabs/LayoutCalcTab";
import { FlexoCalcTab } from "./tabs/FlexoCalcTab";
import { SampleTab } from "./tabs/SampleTab";
import { OperationDialog } from "./dialogs/OperationDialog";
import { LogEventDialog } from "./dialogs/LogEventDialog";
import { JobTicketDialog } from "./dialogs/JobTicketDialog";
import { PackagingDialog } from "./dialogs/PackagingDialog";
import { BoxLabelPrintModal } from "./dialogs/BoxLabelPrintModal";
import { SaveSpecDialog } from "./dialogs/SaveSpecDialog";
import { BomItem } from "../BomMaterialsGrid";
import { WorkOrderPackagingSummary } from "./types";
import { calculatePrintPlanning, generateRouteStepsFromPlan } from "./planningEngine";

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const tAct = useTranslations("DeliveryAct");
  const tShell = useTranslations("DocumentShell");
  const {
    currentUser,
    setTabUnsaved,
    updateTabData,
    upsertProductionQueueItem,
    closeTab,
    requestCloseTab,
    setLevel3Tab,
    theme,
    openTab,
    addNotification,
    createDeliveryActFromOrder,
    masterSpecifications,
    upsertMasterSpecification,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  const [viewMode, setViewMode] = useState<"manager" | "operator">("manager");
  const isOperator = viewMode === "operator";

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
    lamination: data.lamination || "Soft-Touch Matte",
    laminationSides: data.laminationSides || "1s",
    laminationMicron: data.laminationMicron || 28,
    embellishment: data.embellishment || "Spot UV (3D)",
    priceTotal: data.priceTotal || 14850.0,
    currency: data.currency || "USD",
    photoUrl: data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    photoUrls: data.photoUrls || [
      data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
      "/sample-proof.jpg",
      "/files_example/PrintGoo CMYK Label Logo.png"
    ],
    itemCategory: data.itemCategory || "Hangtag",
    width: data.width || 50,
    height: data.height || 90,
    dimensionUnit: data.dimensionUnit || "mm",
    cornerType: data.cornerType || "Square",
    bleed: data.bleed || 2,
    shapeType: data.shapeType || (data.itemCategory === "Carton" ? "carton_box" : data.itemCategory === "Flyer" ? "folded" : "rectangle"),
    foldType: data.foldType || "half_vertical",
    boxType: data.boxType || "tuck_end",
    boxDepth: data.boxDepth || 40,
    customShape: data.customShape || "arch",
    customSvgPath: data.customSvgPath || "",
    colorsConfig: data.colorsConfig || "4+0 (CMYK)",
    frontColors: data.frontColors || { c: true, m: true, y: true, k: true },
    backColors: data.backColors || { c: false, m: false, y: false, k: false },
    spotColors: data.spotColors || ["PANTONE 021 C (Neon Orange)"],
    spotColorItems: data.spotColorItems || [
      { id: "spot-1", name: "PANTONE 021 C (Neon Orange)", code: "021 C", hex: "#fe5000", side: "front" }
    ],
    holeSize: data.holeSize ?? (data.itemCategory === "Hangtag" ? 4 : 0),
    holePosition: data.holePosition || (data.itemCategory === "Hangtag" ? "top-center" : "none"),
    holeOffset: data.holeOffset ?? 6,
    sizes: data.sizes || [
      { id: "1", size: "S", quantity: 1500 },
      { id: "2", size: "M", quantity: 2000 },
      { id: "3", size: "L", quantity: 1500 },
    ],
    kashirovkaMode: data.kashirovkaMode || "none",
    kashirovkaStrategy: data.kashirovkaStrategy || "split_half_sheet",
    kashirovkaLayers: data.kashirovkaLayers || [],
    kashirovkaGlueGsm: data.kashirovkaGlueGsm ?? 25,
    kashirovkaMakeReadySheets: data.kashirovkaMakeReadySheets ?? 50,
    kashirovkaCuringHours: data.kashirovkaCuringHours ?? 12,
    milestones: data.milestones || [
      { id: "m1", name: "Preflight File", department: "Prepress", status: "Done", assignedTo: "Prepress Dept", dueDate: "2026-10-01 10:00" },
      { id: "m2", name: "Materials", department: "Warehouse", status: "Done", assignedTo: "Warehouse Dept", dueDate: "2026-10-02 14:00" },
      { id: "m3", name: "CTP Plates", department: "Prepress", status: "In Progress", assignedTo: "K. Anderson (Prepress)", dueDate: "2026-10-05 16:30" },
      { id: "m4", name: "Printing", department: "Offset", status: "Pending", assignedTo: "Press Dept", dueDate: "2026-10-06 11:30" },
      { id: "m5", name: "Post-press", department: "Finishing", status: "Pending", assignedTo: "Finishing Dept", dueDate: "2026-10-06 18:00" }
    ],
    parentWorkOrderId: data.parentWorkOrderId || data.linkedWoId || undefined,
    isReorder: data.isReorder ?? Boolean(data.parentWorkOrderId),
  });

  const [orderAttachments, setOrderAttachments] = useState<OrderAttachment[]>(
    data.attachments || EXAMPLE_ATTACHMENTS
  );

  const [sampleData, setSampleData] = useState<WorkOrderSampleData>({
    isRequired: data.orderType === "Sample" || data.sampleRequired === true,
    sampleQty: data.sampleQty || 5,
    testPurpose: data.sampleTestPurpose || "color_proof",
    testMachine: data.sampleTestMachine || data.pressMachine || "Heidelberg Speedmaster XL 106",
    substrateSource: data.sampleSubstrateSource || "precut",
    technicalNotes: data.sampleTechNotes || "CMYK spektral zichlik va pantone rang solishtirilsin",
    isProduced: data.sampleProduced || false,
    producedAt: data.sampleProducedAt || undefined,
    producedBy: data.sampleProducedBy || undefined,
    qcPassed: data.sampleQcPassed || false,
    qcNotes: data.sampleQcNotes || undefined,
    approvalStatus:
      data.sampleApprovalStatus ||
      (data.orderType === "Sample" ? "pending_production" : "approved"),
    approvedAt: data.sampleApprovedAt || undefined,
    approvedBy: data.sampleApprovedBy || undefined,
    revisions: data.sampleRevisions || [],
    sampleTargetSize: data.sampleTargetSize || data.sampleSize || undefined,
  });

  const handleSampleChange = (field: keyof WorkOrderSampleData, val: any) => {
    setSampleData((prev) => {
      const next = { ...prev, [field]: val };
      updateTabData(tab.id, { sampleData: next, [field]: val });
      return next;
    });
    setTabUnsaved(tab.id, true);
  };

  const handleApproveSampleAndRelease = () => {
    const today = new Date().toISOString().split("T")[0];
    const approver = currentUser?.name || "Bosh Texnolog";
    const massQty = formData.quantity || 5000;

    setSampleData((prev) => ({
      ...prev,
      approvalStatus: "approved",
      approvedAt: today,
      approvedBy: approver,
      qcPassed: true,
      isProduced: true,
    }));

    handleFieldChange("orderType", "Production");
    handleFieldChange("status", "In Production");

    // Scale operations target to full mass quantity
    setOperations((prev) =>
      prev.map((op, idx) => ({
        ...op,
        qtyCompleted: `0 / ${massQty.toLocaleString()}`,
        status: idx === 0 ? "In Progress" : "Queued",
      }))
    );

    const docNo = data.docNo || tab.id;
    upsertProductionQueueItem({
      id: docNo,
      stage: "Ready to Print",
      sampleStatus: "approved",
      sampleRequired: true,
      quantity: massQty,
    });

    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Namuna tasdiqlandi — Asosiy tirajga ruxsat berildi",
      description: `${docNo}: ${formData.product} buyurtmasi to'liq tiraj (${massQty.toLocaleString()} ${formData.unit}) bilan mashina navbatiga chiqarildi.`,
      severity: "success",
    });
  };

  const handleRejectSample = (
    reasonCategory: SampleRevisionRecord["reasonCategory"],
    notes: string
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const reporter = currentUser?.name || "Bosh Texnolog / OTK";
    const newRev: SampleRevisionRecord = {
      id: `rev-${Date.now()}`,
      revisionNumber: (sampleData.revisions?.length || 0) + 1,
      date: today,
      reasonCategory,
      notes,
      reportedBy: reporter,
    };

    setSampleData((prev) => ({
      ...prev,
      approvalStatus: "revision_requested",
      isProduced: false,
      qcPassed: false,
      revisions: [newRev, ...(prev.revisions || [])],
    }));

    const docNo = data.docNo || tab.id;
    upsertProductionQueueItem({
      id: docNo,
      stage: "Queue",
      sampleStatus: "revision_requested",
    });

    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Namuna qayta ishlashga qaytarildi (Revision)",
      description: `${docNo}: Sabab — ${notes}`,
      severity: "warning",
    });
  };

  // Operations Route State
  const [operations, setOperations] = useState<RouteStep[]>(
    data.operations || getInitialOperations(formData.recipe, formData.pressMachine, formData.department, formData.quantity)
  );

  const prevRecipeRef = React.useRef(formData.recipe);
  React.useEffect(() => {
    // Only reset operations if the RECIPE template was changed to a different one
    if (formData.recipe && prevRecipeRef.current !== formData.recipe) {
      prevRecipeRef.current = formData.recipe;
      setOperations(getInitialOperations(formData.recipe, formData.pressMachine, formData.department, formData.quantity));
    }
  }, [formData.recipe]);

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

  // Save As Specification State
  const [isSaveSpecDialogOpen, setIsSaveSpecDialogOpen] = useState(false);
  const [currentBomItems, setCurrentBomItems] = useState<BomItem[]>([]);

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
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC" | "Waste";
    note: string;
    time: string;
    wasteQty?: number;
    wasteReason?: string;
  }>({
    type: "Run",
    note: "",
    time: "15:30",
  });

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPackagingOpen, setIsPackagingOpen] = useState(false);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

  const handleSavePackaging = (summary: WorkOrderPackagingSummary, markComplete: boolean) => {
    handleFieldChange("packagingData", summary);

    if (markComplete) {
      setOperations((prev) =>
        prev.map((op) => {
          const isPackOp = /qadoq|pack|finishing/i.test(op.name);
          return isPackOp ? { ...op, status: "Finished", qtyCompleted: String(summary.totalPackedQty) } : op;
        })
      );

      const targetWoId = data.docNo || tab.id;
      upsertProductionQueueItem({
        id: targetWoId,
        stage: "Completed",
        completedSheets: summary.totalPackedQty,
      });

      addNotification({
        title: "Qadoqlash yakunlandi",
        description: `${summary.totalBoxes} ta quti (${summary.totalPackedQty.toLocaleString()} dona) qadoqlanib, Tayyor mahsulot omboriga qabulga tayyorlandi.`,
        severity: "success",
      });
    } else {
      addNotification({
        title: "Qadoqlash qoralamasi saqlandi",
        description: `${summary.totalBoxes} ta quti kiritildi.`,
        severity: "info",
      });
    }
    setTabUnsaved(tab.id, true);
  };

  // Action: Create Repeat / Reorder Work Order from current order
  const handleReorderWorkOrder = () => {
    const currentDocNo = data.docNo || tab.id;
    const newWoId = `WO-00${Math.floor(300 + Math.random() * 699)}`;
    const today = new Date().toISOString().split("T")[0];
    const deadlineDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    // Reset operations to Queued with 0 / target quantity
    const resetOperations: RouteStep[] = operations.map((op) => ({
      ...op,
      status: "Queued",
      qtyCompleted: `0 / ${(formData.quantity || 5000).toLocaleString()}`,
    }));

    // Construct reorder payload carrying over all technical specs
    const reorderPayload = {
      ...data,
      ...formData,
      docNo: newWoId,
      parentWorkOrderId: currentDocNo,
      isReorder: true,
      status: "Draft",
      startDate: today,
      deadline: deadlineDate,
      operations: resetOperations,
      sampleRequired: false,
      orderType: "Production",
      sampleData: {
        ...sampleData,
        isRequired: false,
        approvalStatus: "approved",
        qcPassed: true,
        isProduced: true,
        technicalNotes: `Takroriy buyurtma: ${currentDocNo} tasdiqlangan etaloni asosida`,
      },
      milestones: (formData.milestones || []).map((m) => ({
        ...m,
        status: "Pending",
      })),
      packagingData: undefined,
    };

    openTab({
      id: newWoId,
      title: `${newWoId}: ${formData.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: reorderPayload,
    });

    addNotification({
      title: "Qayta buyurtma ochildi",
      description: `${currentDocNo} asosida yangi ${newWoId} takroriy hujjati yaratildi. Barcha texnik parametrlar nusxalandi.`,
      severity: "success",
    });
  };

  const handleSaveAsNewSpec = (specData: {
    code: string;
    name: string;
    department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
    description: string;
    materials: BomItem[];
    operations: RouteStep[];
  }) => {
    const specId = `SPEC-${specData.department.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const costEstimate = `$${(specData.materials.length * 450).toLocaleString()}`;

    // 1. Persist new spec in workspace store
    upsertMasterSpecification({
      id: specId,
      code: specData.code,
      name: specData.name,
      department: specData.department,
      description: specData.description,
      materialsCount: specData.materials.length,
      estimatedCost: costEstimate,
      unit: "pcs",
      materials: specData.materials.map((m) => ({
        id: m.id,
        name: m.name,
        quantity: m.actualQty || m.planQty || m.qty || 1,
        unit: m.unit || "pcs",
        spec: m.spec,
        unitPrice: m.unitPrice,
      })),
      operations: specData.operations.map((op) => ({
        id: op.id,
        name: op.name,
        machineStr: op.machine || "Standard Machine",
      })),
    });

    // 2. Automatically link current work order to newly created recipe
    handleFieldChange("recipe", specData.code);
    if (specData.department !== formData.department) {
      handleDepartmentChange(specData.department);
    }
    setTabUnsaved(tab.id, true);

    // 3. Notify user
    addNotification({
      title: "Yangi Spetsifikatsiya yaratildi",
      description: `${specData.code} (${specData.name}) muvaffaqiyatli saqlandi va joriy buyurtmaga bog'landi.`,
      severity: "success",
    });
  };

  const handleOpenParentWorkOrder = (parentDocNo: string) => {
    openTab({
      id: parentDocNo,
      title: `${parentDocNo}: ${formData.product}`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: parentDocNo,
        customer: formData.customer,
        product: formData.product,
        status: "Completed",
      },
    });
  };

  // Derived Values
  const activeSpec = useMemo(
    () =>
      (masterSpecifications || MASTER_SPECIFICATIONS).find((s) => s.code === formData.recipe) ||
      MASTER_SPECIFICATIONS.find((s) => s.code === formData.recipe),
    [masterSpecifications, formData.recipe]
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

  const deadlineCountdown = useMemo(() => {
    if (!formData.deadline) return null;
    try {
      const target = new Date(formData.deadline).getTime();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
      return isNaN(diffDays) ? null : diffDays;
    } catch {
      return null;
    }
  }, [formData.deadline]);

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
    setFormData((prev) => {
      const next = { ...prev, [field]: val };
      updateTabData(tab.id, { [field]: val });
      return next;
    });
    setTabUnsaved(tab.id, true);
  };

  const handleSizesChange = (newSizes: SizeDistribution[]) => {
    const total = newSizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    setFormData((prev) => {
      const next = {
        ...prev,
        sizes: newSizes,
        ...(newSizes.length > 0 ? { quantity: total } : {}),
      };
      updateTabData(tab.id, {
        sizes: newSizes,
        ...(newSizes.length > 0 ? { quantity: total } : {}),
      });
      return next;
    });
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
    updateTabData(tab.id, {
      department: newDept,
      recipe: defaultRecipe,
      pressMachine: defaultMachine,
    });
    setTabUnsaved(tab.id, true);
  };

  const persistOrderDetails = () => {
    const docNo = data.docNo || tab.id;
    updateTabData(
      tab.id,
      {
        ...data,
        ...formData,
        operations,
        shiftEvents,
        docNo,
        sampleData,
        sampleQty: sampleData.sampleQty,
        sampleRequired: formData.orderType === "Sample",
        sampleApprovalStatus: sampleData.approvalStatus,
        sampleTestPurpose: sampleData.testPurpose,
        sampleTestMachine: sampleData.testMachine,
        sampleProduced: sampleData.isProduced,
        sampleQcPassed: sampleData.qcPassed,
        sampleRevisions: sampleData.revisions,
        attachments: orderAttachments,
      },
      `${docNo}: ${formData.product}`
    );
    upsertProductionQueueItem({
      id: docNo,
      customer: formData.customer,
      product: formData.product,
      quantity:
        formData.orderType === "Sample" && sampleData.approvalStatus !== "approved"
          ? sampleData.sampleQty
          : formData.quantity,
      unit: formData.unit,
      pressMachine: formData.pressMachine,
      department: formData.department,
      priority: (formData.priority as "Normal" | "High" | "Urgent") || "Normal",
      deadline: formData.deadline,
      sampleRequired: formData.orderType === "Sample",
      sampleStatus:
        formData.orderType === "Sample"
          ? sampleData.approvalStatus === "approved"
            ? "approved"
            : sampleData.approvalStatus === "revision_requested"
            ? "revision_requested"
            : sampleData.isProduced
            ? "awaiting_approval"
            : "in_production"
          : "none",
      sampleQty: sampleData.sampleQty,
    });
    setTabUnsaved(tab.id, false);
  };

  const handleSave = () => {
    persistOrderDetails();
    addNotification({
      title: "Order Details Saved",
      description: `${data.docNo || tab.id} — ${formData.product} (${formData.customer}) updated.`,
      severity: "success",
    });
  };

  const handleSaveAndClose = () => {
    persistOrderDetails();
    closeTab(tab.id);
  };

  const handleSaveAndCloseRef = React.useRef(handleSaveAndClose);
  handleSaveAndCloseRef.current = handleSaveAndClose;

  // Listen for Save and Close event from Workspace confirmation modal
  React.useEffect(() => {
    const handleSaveAndCloseEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId: string }>).detail;
      if (detail?.tabId === tab.id) {
        handleSaveAndCloseRef.current();
      }
    };
    window.addEventListener("printgo:save-and-close", handleSaveAndCloseEvent);
    return () => window.removeEventListener("printgo:save-and-close", handleSaveAndCloseEvent);
  }, [tab.id]);

  // Prevent accidental browser tab close / refresh when unsaved
  React.useEffect(() => {
    if (!tab.isUnsaved) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tab.isUnsaved]);

  const activePrintPlan = React.useMemo(
    () =>
      calculatePrintPlanning({
        targetQuantity: formData.quantity || 5000,
        piecesPerSheet: formData.sizes && formData.sizes.length > 0 ? formData.sizes.length : 10,
        frontColors: formData.frontColors || { c: true, m: true, y: true, k: true },
        backColors: formData.backColors || { c: false, m: false, y: false, k: false },
        spotColors: formData.spotColorItems || [],
        printMethod: formData.printMethod,
        parentSheetW: formData.parentSheetW || 1000,
        parentSheetH: formData.parentSheetH || 700,
        pressSheetW: formData.pressSheetW || 500,
        pressSheetH: formData.pressSheetH || 700,
      }),
    [
      formData.quantity,
      formData.sizes,
      formData.frontColors,
      formData.backColors,
      formData.spotColorItems,
      formData.printMethod,
      formData.parentSheetW,
      formData.parentSheetH,
      formData.pressSheetW,
      formData.pressSheetH,
    ]
  );

  const handleApplyRouteFromPlan = (steps?: RouteStep[]) => {
    const newSteps =
      steps ||
      generateRouteStepsFromPlan(
        activePrintPlan,
        formData.pressMachine,
        formData.lamination,
        formData.embellishment
      );
    setOperations(newSteps);
    setTabUnsaved(tab.id, true);
    addNotification({
      title: "Texnologik marshrut yangilandi",
      description: `${newSteps.length} ta operatsiya CTP va bosma hisobi asosida avtomatik shakllantirildi.`,
      severity: "success",
    });
  };

  const [isJobTicketOpen, setIsJobTicketOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsJobTicketOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      wasteQty: undefined,
      wasteReason: undefined,
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
      wasteQty: logEventForm.wasteQty,
      wasteReason: logEventForm.wasteReason,
    };
    setShiftEvents((prev) => [newEvent, ...prev]);
    setIsLogEventDialogOpen(false);
  };

  const isFlexo = formData.department === "Flexo" || (formData.recipe ? formData.recipe.startsWith("FLEXO_") : false);
  const isJacquard = formData.department === "Jacquard" || (formData.recipe ? formData.recipe.startsWith("JACQ_") : false);
  const isOffset = !isFlexo && !isJacquard;

  const rawActiveTab = tab.activeLevel3Tab || "overview";
  const activeTab = (isOperator && (rawActiveTab === "financials" || rawActiveTab === "sample"))
    ? "overview"
    : (!isOffset && rawActiveTab === "layout")
    ? "specs"
    : (!isFlexo && rawActiveTab === "flexo")
    ? "specs"
    : rawActiveTab;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 20);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1C Level-3 Document Workspace Header Bar */}
        <DocumentHeader
          icon={Factory}
          title={formData.product}
          docNo={data.docNo || tab.id}
          date={formData.startDate || "2026-09-30"}
          status={formData.status}
          priority={formData.priority}
          parentDocRef={
            formData.parentWorkOrderId
              ? {
                  docNo: formData.parentWorkOrderId,
                  label: `Asos: ${formData.parentWorkOrderId} (Takroriy)`,
                  onClick: () => handleOpenParentWorkOrder(formData.parentWorkOrderId!),
                }
              : undefined
          }
          actions={
            <>
              {/* 1. Job Ticket / Passport Print (Icon button with tooltip) */}
              <HeaderIconAction
                icon={Printer}
                label={`${tOrder("printSpec") || "Ish pasporti"} (Ctrl+P)`}
                variant="outline"
                onClick={() => setIsJobTicketOpen(true)}
              />

              {/* 2. Packaging (Icon button with badge if boxes packed) */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setIsPackagingOpen(true)}
                      className={cn(
                        "h-7 w-7 relative cursor-pointer",
                        formData.packagingData?.totalBoxes
                          ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                          : ""
                      )}
                      aria-label="Qadoqlash"
                    >
                      <Package className="w-3.5 h-3.5" />
                      {formData.packagingData?.totalBoxes ? (
                        <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-mono flex items-center justify-center font-bold">
                          {formData.packagingData.totalBoxes}
                        </span>
                      ) : null}
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                  {formData.packagingData?.totalBoxes
                    ? `Qadoqlash (${formData.packagingData.totalBoxes} quti)`
                    : "Qutilarga qadoqlash"}
                </TooltipContent>
              </Tooltip>

              {/* 3. Three Vertical Dots (Dropdown Menu with secondary actions) */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                      aria-label="Qo'shimcha amallar"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-60 text-xs">
                  <DropdownMenuItem
                    onClick={handleReorderWorkOrder}
                    className="gap-2 cursor-pointer font-medium text-blue-700 dark:text-blue-400"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Qayta buyurtma (Reorder)</span>
                  </DropdownMenuItem>

                  {!isOperator && (
                    <DropdownMenuItem
                      onClick={() => setIsSaveSpecDialogOpen(true)}
                      className="gap-2 cursor-pointer font-medium text-violet-700 dark:text-violet-400"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      <span>Yangi Spetsifikatsiya qilib saqlash</span>
                    </DropdownMenuItem>
                  )}

                  {!isOperator && (
                    <DropdownMenuItem
                      onClick={() => {
                        const newAct = createDeliveryActFromOrder({
                          orderId: data.docNo || tab.id,
                          workOrderId: data.docNo || tab.id,
                          customer: formData.customer || "Alpha Media Group LLC",
                          product: formData.product || "A4 Hardcover Catalog 96p",
                          quantity: formData.quantity || 5000,
                          unit: formData.unit || "pcs",
                          priceTotal: formData.priceTotal || 14850,
                          currency: formData.currency || "USD",
                        });
                        openTab({
                          id: newAct.id,
                          title: `${newAct.id}: ${newAct.customer}`,
                          type: "delivery-act",
                          module: "finance",
                          isUnsaved: true,
                          activeLevel3Tab: "overview",
                          documentData: newAct,
                        });
                      }}
                      className="gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400 font-medium"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{tAct("createFromOrder") || "Yetkazib berish akti tuzish"}</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setIsJobTicketOpen(true)} className="gap-2 cursor-pointer">
                    <Printer className="w-3.5 h-3.5" />
                    <span>Ish pasporti (Job Ticket)</span>
                    <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setIsPackagingOpen(true)} className="gap-2 cursor-pointer">
                    <Package className="w-3.5 h-3.5" />
                    <span>Qutilarga qadoqlash</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-4 mx-0.5" />

              {/* 4. Save icon button */}
              <HeaderIconAction icon={Save} label={`${tOrder("save")} (Ctrl+S)`} variant="outline" onClick={handleSave} />

              {/* 5. Primary Post & Close button */}
              <Button
                onClick={handleSaveAndClose}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tOrder("postAndClose")}</span>
              </Button>
            </>
          }
        />

        {/* Main Workspace Body: Left Sub-Sidebar + Right Content Viewport */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel={tShell("sections")}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Building2}
                title={formData.customer}
                subtitle={formData.product}
              >
                {formData.parentWorkOrderId && (
                  <button
                    type="button"
                    onClick={() => handleOpenParentWorkOrder(formData.parentWorkOrderId!)}
                    className="w-full text-left flex items-center justify-between px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-700 dark:text-blue-400 font-semibold mb-1.5 hover:bg-blue-500/20 transition-colors cursor-pointer"
                    title={`Asosiy buyurtma: ${formData.parentWorkOrderId} (Ko'rish uchun bosing)`}
                  >
                    <span className="flex items-center gap-1 truncate mr-1">
                      <RotateCw className="w-3 h-3 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">Asos: {formData.parentWorkOrderId}</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-400 text-blue-700 dark:text-blue-300 shrink-0">
                      Takroriy
                    </Badge>
                  </button>
                )}

                {isOperator && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-700 dark:text-amber-400 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Floor Mode · Specs Locked</span>
                  </div>
                )}

                {/* 1. Adad (va Namuna bo'lsa sinov adadi) */}
                <InfoRow label={tShell("quantity")}>
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-foreground">
                      {formData.quantity.toLocaleString()} {formData.unit}
                    </span>
                    {formData.orderType === "Sample" && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        (🧪 Namuna: {sampleData.sampleQty} dona)
                      </span>
                    )}
                  </div>
                </InfoRow>

                {/* 2. Qog'oz / Xomashyo */}
                <InfoRow label="Qog'oz" title={formData.paperStock}>
                  <span className="truncate max-w-[125px] font-medium text-foreground" title={formData.paperStock}>
                    {formData.paperStock || "Belgilanmagan"}
                  </span>
                </InfoRow>

                {/* 3. Ranglilik (CMYK / Pantones) */}
                <InfoRow label="Ranglilik">
                  <span className="font-mono font-medium text-foreground">
                    {formData.colorsConfig || "4+0 (CMYK)"}
                  </span>
                </InfoRow>

                {/* 4. Tayinlangan Uskuna */}
                <InfoRow label={tShell("machine")} title={formData.pressMachine}>
                  <span
                    className="truncate max-w-[125px] font-medium text-blue-600 dark:text-blue-400"
                    title={formData.pressMachine}
                  >
                    {formData.pressMachine.replace("Speedmaster ", "")}
                  </span>
                </InfoRow>

                {/* 5. Muddat va Qolgan kunlar */}
                <InfoRow label={tShell("deadline")}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-foreground">{formData.deadline}</span>
                    {deadlineCountdown !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1 py-0 h-4 font-mono font-medium",
                          deadlineCountdown < 0
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : deadlineCountdown <= 2
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {deadlineCountdown < 0
                          ? "Kechikdi"
                          : deadlineCountdown === 0
                          ? "Bugun"
                          : `${deadlineCountdown}k`}
                      </Badge>
                    )}
                  </div>
                </InfoRow>

                {/* 6. Holat / Bosqich */}
                <InfoRow label="Bosqich">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-medium",
                      formData.status === "In Production" || formData.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {formData.status}
                  </Badge>
                </InfoRow>

                {/* 7. Xomashyo yetishmasligi (BOM shortage alert) */}
                {hasShortage && (
                  <div className="flex items-center gap-1 pt-1.5 border-t border-border/50 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">{tShell("materialShortage")}</span>
                  </div>
                )}
              </SidebarSummaryCard>
            }
            items={[
              { id: "overview", label: tOrder("tabOverview"), icon: FileText },
              {
                id: "specs",
                label: tShell("specsAndDrawing"),
                icon: Ruler,
                badge: `${formData.width || 50}×${formData.height || 90}`,
              },
              ...(isOffset ? [{ id: "layout", label: tOrder("tabPlanning"), icon: LayoutTemplate }] : []),
              ...(isFlexo ? [{ id: "flexo", label: "Flexo Imposition", icon: Disc }] : []),
              {
                id: "materials",
                label: tOrder("tabMaterials"),
                icon: Boxes,
                badge: currentRecipeMaterials.length,
                badgeClassName: hasShortage
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                  : undefined,
              },
              { id: "operations", label: tOrder("tabOperations"), icon: Factory, badge: operations.length },
              {
                id: "timeline",
                label: tOrder("tabTimeline"),
                icon: Clock,
                badge: `${operations.filter((o) => o.status === "Finished").length}/${operations.length}`,
              },
              ...(!isOperator
                ? [
                    {
                      id: "sample",
                      label: formData.orderType === "Sample" ? "Namuna (Sample)" : "Namuna sinovi",
                      icon: FlaskConical,
                      badge:
                        formData.orderType === "Production"
                          ? "Kerak emas"
                          : sampleData.approvalStatus === "approved"
                          ? "Tasdiqlangan"
                          : sampleData.approvalStatus === "revision_requested"
                          ? "Reviziya"
                          : sampleData.isProduced
                          ? "Tasdiq kutilmoqda"
                          : "Tayyorlanmoqda",
                      badgeClassName:
                        formData.orderType === "Production"
                          ? "bg-muted text-muted-foreground"
                          : sampleData.approvalStatus === "approved"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                          : sampleData.approvalStatus === "revision_requested"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold",
                    },
                    {
                      id: "financials",
                      label: tOrder("tabCosting"),
                      icon: DollarSign,
                      badge: formatMoney(formData.priceTotal, formData.currency, 0),
                    },
                  ]
                : []),
              { id: "files", label: tShell("filesAndDocs"), icon: Paperclip, badge: orderAttachments.length || null },
              { id: "history", label: tOrder("tabHistory"), icon: History },
            ]}
          />

          {/* ── RIGHT MAIN VIEWPORT (flex-1) ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {/* Tab 1: Overview */}
            <OverviewTab
              formData={formData}
              handleFieldChange={handleFieldChange}
              handleSizesChange={handleSizesChange}
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
              sampleData={sampleData}
              onSampleChange={handleSampleChange}
              onOpenLightbox={() => setIsLightboxOpen(true)}
              onOpenTab={openTab}
              onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              isOperator={isOperator}
              onToggleOperatorMode={(mode) => setViewMode(mode)}
              tOrder={tOrder}
            />

            {/* Tab 2: Specifications & Die-Line (Extracted & Enhanced) */}
            <SpecificationsTab
              formData={formData}
              handleFieldChange={handleFieldChange}
              handleSizesChange={handleSizesChange}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
              isOperator={isOperator}
              sampleData={sampleData}
              onSampleChange={handleSampleChange}
            />

            {/* Tab: Imposition / Layout for Offset & Front-Back Print Planning */}
            {isOffset && (
              <TabsContent value="layout" className="flex-1 overflow-y-auto p-3 m-0 no-scrollbar">
                <LayoutCalcTab
                  sizes={formData.sizes || []}
                  defaultQuantity={formData.quantity}
                  docNo={data.docNo || tab.id}
                  orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
                  defaultProdW={formData.width}
                  defaultProdH={formData.height}
                  defaultBleed={formData.bleed}
                  frontColors={formData.frontColors}
                  backColors={formData.backColors}
                  spotColors={formData.spotColorItems}
                  printMethod={formData.printMethod}
                  onPrintMethodChange={(method) => handleFieldChange("printMethod", method)}
                  onApplyRouteToOperations={handleApplyRouteFromPlan}
                  pressMachine={formData.pressMachine}
                  paperStock={formData.paperStock}
                  lamination={formData.lamination}
                  embellishment={formData.embellishment}
                  isOperator={isOperator}
                  onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                  kashirovkaMode={formData.kashirovkaMode}
                  kashirovkaStrategy={formData.kashirovkaStrategy}
                  kashirovkaLayers={formData.kashirovkaLayers}
                  kashirovkaGlueGsm={formData.kashirovkaGlueGsm}
                  kashirovkaMakeReadySheets={formData.kashirovkaMakeReadySheets}
                  onKashirovkaChange={(patch) => {
                    if (patch.kashirovkaMode !== undefined) {
                      handleFieldChange("kashirovkaMode", patch.kashirovkaMode);
                    }
                    if (patch.kashirovkaStrategy !== undefined) {
                      handleFieldChange("kashirovkaStrategy", patch.kashirovkaStrategy);
                    }
                    if (patch.kashirovkaMakeReadySheets !== undefined) {
                      handleFieldChange("kashirovkaMakeReadySheets", patch.kashirovkaMakeReadySheets);
                    }
                  }}
                  sampleQty={sampleData.sampleQty}
                  onSampleQtyChange={(q) => handleSampleChange("sampleQty", q)}
                />
              </TabsContent>
            )}

            {/* Tab: Flexo Imposition & Cylinder Repeat */}
            {isFlexo && (
              <TabsContent value="flexo" className="flex-1 overflow-y-auto p-3 m-0 no-scrollbar">
                <FlexoCalcTab
                  defaultQuantity={formData.quantity}
                  docNo={data.docNo || tab.id}
                  orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
                  customer={formData.customer}
                  productName={formData.product}
                  defaultProdW={formData.width}
                  defaultProdH={formData.height}
                  defaultBleed={formData.bleed}
                  onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                  onAuditLog={() => {}}
                  onFlexoSave={(res) => {
                    if (
                      formData.flexoCylinderTeeth !== res.gearTeeth ||
                      formData.flexoWebWidth !== res.webWidth
                    ) {
                      setFormData((prev) => ({
                        ...prev,
                        flexoCylinderTeeth: res.gearTeeth,
                        flexoWebWidth: res.webWidth,
                      }));
                    }
                  }}
                />
              </TabsContent>
            )}

            {/* Tab 3: Materials BOM */}
            <MaterialsTab
              tabId={tab.id}
              department={formData.department}
              recipe={formData.recipe}
              activeSpec={activeSpec}
              onRecipeChange={(code, dept) => {
                handleFieldChange("recipe", code);
                if (dept && formData.department !== dept) {
                  handleDepartmentChange(dept);
                }
              }}
              onOpenTab={openTab}
              isOperator={isOperator}
              onItemsChange={(newItems) => setCurrentBomItems(newItems)}
              onSaveAsSpec={(items) => {
                setCurrentBomItems(items);
                setIsSaveSpecDialogOpen(true);
              }}
            />

            {/* Tab 4: Technological Route */}
            <OperationsTab
              workOrderId={data.docNo || tab.id}
              fallbackData={{
                customer: formData.customer,
                product: formData.product,
                machine: formData.pressMachine,
                department: formData.department,
                quantity: formData.quantity,
                deadline: formData.deadline,
              }}
              operations={operations}
              setOperations={setOperations}
              opSelection={opSelection}
              setOpSelection={setOpSelection}
              onOpenAddOperation={handleOpenAddOperation}
              onOpenEditOperation={handleOpenEditOperation}
              onDeleteSelectedOperation={handleDeleteSelectedOperation}
              isDark={isDark}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              onSyncFromPlan={() => handleApplyRouteFromPlan()}
              onOpenInTimeline={(opId) => {
                setSelectedTimelineOpId(opId);
                setLevel3Tab(tab.id, "timeline");
              }}
              onOpenPackaging={() => setIsPackagingOpen(true)}
              isPacked={formData.packagingData?.isCompleted}
              packagesCount={formData.packagingData?.totalBoxes}
            />

            {/* Tab 5: Shift Timeline & Notes */}
            <ShiftTimelineTab
              operations={operations}
              selectedTimelineOpId={selectedTimelineOpId}
              setSelectedTimelineOpId={setSelectedTimelineOpId}
              selectedOp={selectedOp}
              selectedOpEvents={selectedOpEvents}
              onOpenLogEvent={handleOpenLogEvent}
              onUpdateStepOutput={(opId, newCompleted, target, unitSuffix, logNote, wasteQty, wasteReason) => {
                setOperations((prev) =>
                  prev.map((op) => {
                    if (op.id !== opId) return op;
                    const formatted = `${newCompleted.toLocaleString()} / ${target.toLocaleString()}${unitSuffix}`;
                    const nextStatus =
                      newCompleted >= target ? "Finished" : newCompleted > 0 ? "In Progress" : "Queued";
                    return {
                      ...op,
                      qtyCompleted: formatted,
                      status: nextStatus,
                    };
                  })
                );
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                const newEvent: ShiftEvent = {
                  id: "e_" + Date.now(),
                  opId,
                  time: timeStr,
                  type: wasteQty && wasteQty > 0 ? "Waste" : "Run",
                  note: logNote,
                  operator: selectedOp.operator,
                  wasteQty,
                  wasteReason,
                };
                setShiftEvents((prev) => [newEvent, ...prev]);
                setTabUnsaved(tab.id, true);
              }}
              onChangeStepStatus={(opId, status) => {
                setOperations((prev) =>
                  prev.map((op) => (op.id === opId ? { ...op, status } : op))
                );
                setTabUnsaved(tab.id, true);
              }}
            />

            {/* Tab: Physical Sample (Hidden for Operators) */}
            {!isOperator && (
              <TabsContent value="sample" className="flex-1 overflow-y-auto p-3 m-0 space-y-3 no-scrollbar">
                <SampleTab
                  formData={formData}
                  sampleData={sampleData}
                  handleSampleChange={handleSampleChange}
                  handleFieldChange={handleFieldChange}
                  onApproveAndReleaseMassRun={handleApproveSampleAndRelease}
                  onRejectSample={handleRejectSample}
                  tabId={tab.id}
                />
              </TabsContent>
            )}

            {/* Tab 6: Financials (Hidden for Operators) */}
            {!isOperator && (
              <FinancialsTab
                shiftEvents={shiftEvents}
                formData={formData}
                printPlan={activePrintPlan}
                operations={operations}
                docNo={data.docNo || tab.id}
                onPriceChange={(newPrice, fin) => {
                  handleFieldChange("priceTotal", newPrice);
                  if (fin) {
                    handleFieldChange("financials", fin);
                  }
                  persistOrderDetails();
                }}
              />
            )}

            {/* Tab 7: Files & Tech Documents */}
            <FilesTab
              orderAttachments={orderAttachments}
              setOrderAttachments={setOrderAttachments}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              docNo={data.docNo || tab.id}
            />

            {/* Tab 8: History */}
            <HistoryTab
              docNo={data.docNo || tab.id}
              formData={formData}
            />
          </div>
        </div>
      </Tabs>

      {/* Dialog: Routing Operation */}
      <OperationDialog
        isOpen={isOpDialogOpen}
        onOpenChange={setIsOpDialogOpen}
        editingOpIndex={editingOpIndex}
        form={opDialogForm}
        setForm={setOpDialogForm}
        onSave={handleSaveOperationDialog}
        customerName={formData.customer}
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

      {/* Unified Order Passport / Job Ticket Dialog */}
      <JobTicketDialog
        isOpen={isJobTicketOpen}
        onOpenChange={setIsJobTicketOpen}
        workOrderId={data.docNo || tab.id}
        formData={formData}
        activeSpec={activeSpec}
        activeMachine={activeMachine}
        operations={operations}
        materials={currentRecipeMaterials}
        shiftEvents={shiftEvents}
        onExportSuccess={(docId) =>
          addNotification({
            title: tOrder("printSpec"),
            description: `PDF exported: ${docId}`,
            severity: "success",
          })
        }
      />

      {/* Quick Packaging Dialog */}
      <PackagingDialog
        isOpen={isPackagingOpen}
        onOpenChange={setIsPackagingOpen}
        workOrderNo={data.docNo || tab.id}
        clientOrderNo={formData.linkedOrderId}
        customer={formData.customer}
        product={formData.product}
        targetQuantity={formData.quantity}
        unit={formData.unit}
        sizes={formData.sizes}
        existingPackaging={formData.packagingData}
        onSavePackaging={handleSavePackaging}
        onOpenPrintModal={(summary) => {
          handleFieldChange("packagingData", summary);
          setIsLabelPrintOpen(true);
        }}
      />

      {/* Box Label Passport Print Modal (100x150 mm) */}
      <BoxLabelPrintModal
        isOpen={isLabelPrintOpen}
        onOpenChange={setIsLabelPrintOpen}
        workOrderNo={data.docNo || tab.id}
        clientOrderNo={formData.linkedOrderId}
        customer={formData.customer}
        product={formData.product}
        boxes={formData.packagingData?.boxes || []}
        totalBoxes={formData.packagingData?.totalBoxes || 0}
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

      {/* Save As Specification Dialog */}
      <SaveSpecDialog
        isOpen={isSaveSpecDialogOpen}
        onOpenChange={setIsSaveSpecDialogOpen}
        department={formData.department}
        currentRecipeCode={formData.recipe}
        currentRecipeName={activeSpec?.name}
        materials={currentBomItems}
        operations={operations}
        onSaveSpec={handleSaveAsNewSpec}
      />
    </div>
  );
}
