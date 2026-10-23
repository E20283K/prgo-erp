"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Stamp,
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
import { useLookupStore } from "@/store/lookupStore";
import { useTranslations } from "next-intl";
import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid";

import {
  WorkOrderFormData,
  WorkOrderSampleData,
  SampleRevisionRecord,
  SizeDistribution,
  SkuArtwork,
  OrderAttachment,
  RouteStep,
  ShiftEvent,
  MasterSpecification,
  MASTER_SPECIFICATIONS,
  SITE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  MACHINE_OPTIONS,
  RECIPE_MATERIALS,
  MACHINE_MAP,
  getInitialOperations,
  getNextWorkOrderNo,
  type WorkOrderDepartment,
} from "./types";
import { EXAMPLE_ATTACHMENTS } from "@/components/file-viewer/file-utils";
import { OverviewTab, getDisplayImageUrl } from "./tabs/OverviewTab";
import { SpecificationsTab } from "./tabs/SpecificationsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { ShiftTimelineTab } from "./tabs/ShiftTimelineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { FinancialsTab } from "./tabs/FinancialsTab";
import { FilesTab } from "../common/FilesTab";
import { LayoutCalcTab } from "./tabs/LayoutCalcTab";
import { FlexoCalcTab } from "./tabs/FlexoCalcTab";
import { OperationDialog } from "./dialogs/OperationDialog";
import { LogEventDialog } from "./dialogs/LogEventDialog";
import { JobTicketDialog } from "./dialogs/JobTicketDialog";
import { PackagingDialog } from "./dialogs/PackagingDialog";
import { BoxLabelPrintModal } from "./dialogs/BoxLabelPrintModal";
import { SaveSpecDialog } from "./dialogs/SaveSpecDialog";
import { BomItem, RECIPE_BOM_MAP } from "../BomMaterialsGrid";
import { WorkOrderPackagingSummary, WorkOrderToolingItem } from "./types";
import { PrepressToolingTab } from "./tabs/PrepressToolingTab";
import { calculatePrintPlanning, generateRouteStepsFromPlan } from "./planningEngine";

function getInitialToolingItems(data: Partial<WorkOrderFormData>, docNo: string): WorkOrderToolingItem[] {
  if (data.toolingItems && data.toolingItems.length > 0) {
    return data.toolingItems;
  }

  const items: WorkOrderToolingItem[] = [];
  const dept = data.department || "Offset";
  const isUsd = (data.currency || "UZS").toUpperCase() === "USD";

  // 1. CTP metall formalar
  if (dept === "Offset") {
    items.push({
      id: `TL-CTP-${Date.now()}`,
      category: "ctp_plates",
      name: `${docNo || "WO"} CTP Metall Formalar Komplekti`,
      specDetails: `Format: ${data.pressSheetW || 700}×${data.pressSheetH || 1000} mm (CMYK 4 rang)`,
      quantity: 4,
      unit: "dona",
      estimatedCost: isUsd ? 25 : 300000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  } else if (dept === "Flexo") {
    items.push({
      id: `TL-FLX-${Date.now()}`,
      category: "flexo_polymer",
      name: `${docNo || "WO"} Flexo Polimer Formalar`,
      specDetails: `Digital Plate 1.14mm, ${data.flexoColors || 4} rang`,
      quantity: data.flexoColors || 4,
      unit: "dona",
      estimatedCost: isUsd ? 35 : 450000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  // 2. Kesish shtampi (agar shaklli kesim yoki die-cut bo'lsa)
  if (
    data.shapeType === "custom_die" ||
    data.shapeType === "carton_box" ||
    data.shapeType === "circle" ||
    data.shapeType === "oval" ||
    data.cornerType === "Die-cut" ||
    data.selectedToolingId
  ) {
    items.push({
      id: `TL-DIE-${Date.now() + 1}`,
      category: "die_cutting",
      name: data.selectedToolingName || `${data.product || "Mahsulot"} Kesish Shtampi (Flatbed Die)`,
      specDetails: `Razmer: ${data.width || 700}×${data.height || 1000} mm, 23.8mm pichoq`,
      quantity: 1,
      unit: "dona",
      estimatedCost: data.toolingProcurementCost || (isUsd ? 65 : 800000),
      currency: data.currency || "UZS",
      status: data.selectedToolingId ? "Ready" : "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Folga klishesi
  if (data.embellishment?.toLowerCase().includes("foil") || data.coating?.toLowerCase().includes("foil")) {
    items.push({
      id: `TL-FOIL-${Date.now() + 2}`,
      category: "foil_cliche",
      name: `${data.product || "Mahsulot"} Zarhal (Hot Foil) Klishesi`,
      specDetails: "Material: Latun (Jez 3mm CNC gravirovka)",
      quantity: 1,
      unit: "dona",
      estimatedCost: isUsd ? 30 : 350000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  // 4. Kongrev klishesi
  if (data.embellishment?.toLowerCase().includes("emboss") || data.coating?.toLowerCase().includes("emboss")) {
    items.push({
      id: `TL-EMB-${Date.now() + 3}`,
      category: "emboss_cliche",
      name: `${data.product || "Mahsulot"} Kongrev (Embossing) Klishesi`,
      specDetails: "Material: Magniy 4mm (Matritsa + Patriysa)",
      quantity: 1,
      unit: "dona",
      estimatedCost: isUsd ? 25 : 300000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const tAct = useTranslations("DeliveryAct");
  const tShell = useTranslations("DocumentShell");
  const {
    currentUser,
    setTabUnsaved,
    updateTabData,
    replaceTabId,
    upsertProductionQueueItem,
    upsertWorkOrderAsync,
    toggleReadinessCheck,
    loadProductionQueue,
    closeTab,
    requestCloseTab,
    setLevel3Tab,
    theme,
    openTab,
    addNotification,
    createDeliveryActFromOrder,
    masterSpecifications,
    upsertMasterSpecification,
    loadCrmCustomers,
    machines: storeMachines,
    loadMachines,
  } = useWorkspaceStore();

  useEffect(() => {
    loadCrmCustomers();
    loadMachines();
  }, [loadCrmCustomers, loadMachines]);
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  // Find real queue item from workspaceStore to ensure all photos and attachments are 100% available
  const initialDocNo = data.docNo || (tab.id.startsWith("draft-") || tab.id.startsWith("temp-") ? "" : tab.id);
  const [docNo, setDocNo] = useState(initialDocNo);
  const isDraft = !docNo || tab.id.startsWith("draft-") || tab.id.startsWith("temp-");

  const queueLookupKey = docNo || tab.id;
  const initialQueueItem = useWorkspaceStore.getState().productionQueue.find((q) => q.id === queueLookupKey);
  const queueItem = useWorkspaceStore(
    useCallback((s) => s.productionQueue.find((q) => q.id === queueLookupKey), [queueLookupKey])
  );

  const effectivePhotoUrl = data.photoUrl || (data.photoUrls && data.photoUrls[0]) || initialQueueItem?.photoUrl || (initialQueueItem?.photoUrls && initialQueueItem?.photoUrls[0]) || "";
  const effectivePhotoUrls: string[] = (data.photoUrls && data.photoUrls.length > 0)
    ? data.photoUrls
    : (data.photoUrl
        ? [data.photoUrl]
        : (initialQueueItem?.photoUrls && initialQueueItem?.photoUrls.length > 0
            ? initialQueueItem.photoUrls
            : (initialQueueItem?.photoUrl ? [initialQueueItem.photoUrl] : [])));
  const initialAttachments = (data.attachments && data.attachments.length > 0)
    ? data.attachments
    : (initialQueueItem?.attachments && initialQueueItem.attachments.length > 0 ? initialQueueItem.attachments : []);

  // Role-Based Access Control (RBAC): Determine operator mode automatically from currentUser
  const isOperator = useMemo(() => {
    if (!currentUser) return false;
    // Admins and managers have full access
    if (currentUser.role === "admin" || currentUser.role === "System Administrator") {
      return false;
    }
    const role = (currentUser.role || "").toLowerCase();
    // If role indicates an operator / pressman / floor technician
    if (role.includes("operator") || role.includes("pressman") || role.includes("stanokchi")) {
      return true;
    }
    // If user explicitly lacks production edit permissions
    if (currentUser.permissions?.production && !currentUser.permissions.production.edit) {
      return true;
    }
    return false;
  }, [currentUser]);

  const [formData, setFormData] = useState<WorkOrderFormData>({
    customer: data.customer || initialQueueItem?.customer || "",
    product: data.product || initialQueueItem?.product || "",
    department: data.department || initialQueueItem?.department || "Offset",
    site: data.site || initialQueueItem?.site || "",
    recipe: data.recipe || initialQueueItem?.recipe || "",
    quantity: data.quantity || initialQueueItem?.quantity || 0,
    unit: data.unit || initialQueueItem?.unit || "pcs",
    status: data.status || initialQueueItem?.stage || "Draft",
    priority: data.priority || initialQueueItem?.priority || "Normal",
    pressMachine: data.pressMachine || initialQueueItem?.pressMachine || "",
    startDate: data.startDate || initialQueueItem?.startDate || "",
    deadline: data.deadline || initialQueueItem?.deadline || "",
    paperStock: data.paperStock || initialQueueItem?.paperStock || "",
    coating: data.coating || initialQueueItem?.coating || "",
    lamination: data.lamination || initialQueueItem?.lamination || "",
    laminationSides: data.laminationSides || initialQueueItem?.laminationSides || "1s",
    laminationMicron: data.laminationMicron ?? initialQueueItem?.laminationMicron ?? 0,
    embellishment: data.embellishment || initialQueueItem?.embellishment || "",
    priceTotal: data.priceTotal || initialQueueItem?.priceTotal || 0,
    currency: data.currency || initialQueueItem?.currency || "UZS",
    photoUrl: effectivePhotoUrl,
    photoUrls: effectivePhotoUrls,
    artworkFront: data.artworkFront || initialQueueItem?.artworkFront || "",
    artworkBack: data.artworkBack || initialQueueItem?.artworkBack || "",
    itemCategory: data.itemCategory || initialQueueItem?.itemCategory || "",
    width: data.width || initialQueueItem?.width || data.dimensions?.width || initialQueueItem?.dimensions?.width || 0,
    height: data.height || initialQueueItem?.height || data.dimensions?.height || initialQueueItem?.dimensions?.height || 0,
    dimensionUnit: data.dimensionUnit || initialQueueItem?.dimensionUnit || "mm",
    cornerType: data.cornerType || initialQueueItem?.cornerType || data.dimensions?.cornerType || initialQueueItem?.dimensions?.cornerType || "Square",
    bleed: data.bleed ?? initialQueueItem?.bleed ?? data.dimensions?.bleed ?? 0,
    shapeType: data.shapeType || initialQueueItem?.shapeType || data.dimensions?.shapeType || "rectangle",
    foldType: data.foldType || initialQueueItem?.foldType || data.dimensions?.foldType || "",
    boxType: data.boxType || initialQueueItem?.boxType || data.dimensions?.boxType || "",
    boxDepth: data.boxDepth ?? initialQueueItem?.boxDepth ?? data.dimensions?.boxDepth ?? 0,
    customShape: data.customShape || initialQueueItem?.customShape || data.dimensions?.customShape || "",
    customSvgPath: data.customSvgPath || initialQueueItem?.customSvgPath || data.dimensions?.customSvgPath || "",
    colorsConfig: data.colorsConfig || initialQueueItem?.colorsConfig || initialQueueItem?.colors || "",
    frontColors: data.frontColors || initialQueueItem?.frontColors || { c: false, m: false, y: false, k: false },
    backColors: data.backColors || initialQueueItem?.backColors || { c: false, m: false, y: false, k: false },
    spotColors: (data.spotColors && data.spotColors.length > 0) ? data.spotColors : (initialQueueItem?.spotColors || []),
    spotColorItems: (data.spotColorItems && data.spotColorItems.length > 0) ? data.spotColorItems : (initialQueueItem?.spotColorItems || []),
    holeSize: data.holeSize ?? initialQueueItem?.holeSize ?? data.dimensions?.holeSize ?? 0,
    holePosition: data.holePosition || initialQueueItem?.holePosition || data.dimensions?.holePosition || "none",
    holeOffset: data.holeOffset ?? initialQueueItem?.holeOffset ?? data.dimensions?.holeOffset ?? 0,
    sizes: (data.sizes && data.sizes.length > 0) ? data.sizes : (initialQueueItem?.sizes || []),
    kashirovkaMode: data.kashirovkaMode || initialQueueItem?.kashirovkaMode || "none",
    kashirovkaStrategy: data.kashirovkaStrategy || initialQueueItem?.kashirovkaStrategy || "split_half_sheet",
    kashirovkaLayers: (data.kashirovkaLayers && data.kashirovkaLayers.length > 0) ? data.kashirovkaLayers : (initialQueueItem?.kashirovkaLayers || []),
    kashirovkaGlueGsm: data.kashirovkaGlueGsm ?? initialQueueItem?.kashirovkaGlueGsm ?? 0,
    kashirovkaMakeReadySheets: data.kashirovkaMakeReadySheets ?? initialQueueItem?.kashirovkaMakeReadySheets ?? 0,
    kashirovkaCuringHours: data.kashirovkaCuringHours ?? initialQueueItem?.kashirovkaCuringHours ?? 0,
    selectedToolingId: data.selectedToolingId || initialQueueItem?.selectedToolingId || "",
    selectedToolingName: data.selectedToolingName || initialQueueItem?.selectedToolingName || "",
    toolingProcurementNeeded: data.toolingProcurementNeeded ?? initialQueueItem?.toolingProcurementNeeded ?? false,
    toolingProcurementCost: data.toolingProcurementCost ?? initialQueueItem?.toolingProcurementCost ?? 0,
    milestones: data.milestones || initialQueueItem?.milestones || [],
    financials: data.financials || initialQueueItem?.financials,
    parentWorkOrderId: data.parentWorkOrderId || data.linkedWoId || undefined,
    isReorder: data.isReorder ?? Boolean(data.parentWorkOrderId),
    toolingItems:
      data.toolingItems ||
      (data.dimensions as any)?.toolingItems ||
      initialQueueItem?.toolingItems ||
      (initialQueueItem?.dimensions as any)?.toolingItems ||
      getInitialToolingItems(data, docNo || tab.id),
  });

  const [orderAttachments, setOrderAttachments] = useState<OrderAttachment[]>(() => {
    const list = initialAttachments && Array.isArray(initialAttachments) ? [...initialAttachments] : [];
    const existingUrls = new Set(list.map((a: any) => a.url));
    const allPhotos: string[] = effectivePhotoUrls;

    allPhotos.forEach((url, idx) => {
      if (url && !existingUrls.has(url)) {
        list.push({
          id: `att-initial-photo-${idx}`,
          name: `Sample_Proof_${idx + 1}.jpg`,
          size: "Sample Proof",
          type: "image/jpeg",
          date: new Date().toISOString().slice(0, 16).replace("T", " "),
          isImage: true,
          url,
        });
        existingUrls.add(url);
      }
    });
    return list;
  });

  const [skuArtworks, setSkuArtworks] = useState<SkuArtwork[]>(
    data.skuArtworks || initialQueueItem?.skuArtworks || data.dimensions?.skuArtworks || initialQueueItem?.dimensions?.skuArtworks || []
  );

  // Keep state synchronized with queueItem if loaded asynchronously
  useEffect(() => {
    if (queueItem && !tab.isUnsaved) {
      if (!formData.photoUrl && (queueItem.photoUrl || (queueItem.photoUrls && queueItem.photoUrls.length > 0))) {
        const qUrl = queueItem.photoUrl || queueItem.photoUrls![0];
        const qUrls = queueItem.photoUrls && queueItem.photoUrls.length > 0 ? queueItem.photoUrls : [qUrl];
        setFormData((prev) => ({
          ...prev,
          photoUrl: qUrl,
          photoUrls: qUrls,
          artworkFront: prev.artworkFront || data.artworkFront || "",
        }));
      }
      if (queueItem.attachments && queueItem.attachments.length > 0 && orderAttachments.length === 0) {
        setOrderAttachments(queueItem.attachments);
      }
      if (queueItem.skuArtworks && queueItem.skuArtworks.length > 0 && skuArtworks.length === 0) {
        setSkuArtworks(queueItem.skuArtworks);
      }
      if (queueItem.toolingItems && queueItem.toolingItems.length > 0 && (!formData.toolingItems || formData.toolingItems.length === 0)) {
        setFormData((prev) => ({ ...prev, toolingItems: queueItem.toolingItems }));
      }
    }
  }, [queueItem, tab.isUnsaved, formData.photoUrl, orderAttachments.length, skuArtworks.length, formData.toolingItems?.length]);

  const handleSkuArtworksChange = (artworks: SkuArtwork[]) => {
    setSkuArtworks(artworks);
    setFormData((prev) => ({ ...prev, skuArtworks: artworks }));
    updateTabData(tab.id, { skuArtworks: artworks });
    setTabUnsaved(tab.id, true);
  };

  const [sampleData, setSampleData] = useState<WorkOrderSampleData>({
    isRequired: data.orderType === "Sample" || data.sampleRequired === true,
    sampleQty: data.sampleQty || 0,
    testPurpose: data.sampleTestPurpose || "color_proof",
    testMachine: data.sampleTestMachine || "",
    substrateSource: data.sampleSubstrateSource || "precut",
    technicalNotes: data.sampleTechNotes || "",
    isProduced: data.sampleProduced || false,
    producedAt: data.sampleProducedAt || undefined,
    producedBy: data.sampleProducedBy || undefined,
    qcPassed: data.sampleQcPassed || false,
    qcNotes: data.sampleQcNotes || undefined,
    approvalStatus: data.sampleApprovalStatus || "none",
    approvedAt: data.sampleApprovedAt || undefined,
    approvedBy: data.sampleApprovedBy || undefined,
    revisions: data.sampleRevisions || [],
    sampleTargetSize: data.sampleTargetSize || data.sampleSize || undefined,
  });

  const handleSampleChange = (field: keyof WorkOrderSampleData, val: any) => {
    setSampleData((prev) => ({ ...prev, [field]: val }));
    updateTabData(tab.id, { [field]: val });
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
    data.operations || []
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
    machine: formData.pressMachine || "",
    operator: "",
    duration: 1,
    qtyCompleted: `0 / ${formData.quantity || 0}`,
    status: "Queued",
  });

  // Save As Specification State
  const [isSaveSpecDialogOpen, setIsSaveSpecDialogOpen] = useState(false);
  const [currentBomItems, setCurrentBomItems] = useState<BomItem[]>(data.materials || []);

  // Shift Timeline & Log Events State
  const [selectedTimelineOpId, setSelectedTimelineOpId] = useState<string>("1");
  const [shiftEvents, setShiftEvents] = useState<ShiftEvent[]>(
    data.events || data.shiftEvents || []
  );

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
    const currentDocNo = docNo || data.docNo || tab.id;
    const draftId = `draft-wo-${Date.now()}`;
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
      docNo: "",
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
      id: draftId,
      title: `Yangi: ${formData.product} (Takroriy)`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        ...reorderPayload,
        id: draftId,
        docNo: "",
      },
    });

    addNotification({
      title: "Qayta buyurtma ochildi",
      description: `${currentDocNo} asosida yangi takroriy buyurtma qoralamasi ochildi. Barcha texnik parametrlar nusxalandi.`,
      severity: "success",
    });
  };


  const handleSelectProductTemplate = (spec: MasterSpecification) => {
    handleFieldChange("product", spec.name);
    handleFieldChange("recipe", spec.code);
    if (spec.department && spec.department !== formData.department) {
      handleDepartmentChange(spec.department);
    }
    // Load associated BOM materials
    if (RECIPE_BOM_MAP[spec.code]) {
      const newItems = RECIPE_BOM_MAP[spec.code];
      setCurrentBomItems(newItems);
      handleFieldChange("materials", newItems);
    }
    // Load technological route operations
    const initialOps = getInitialOperations(spec.code, formData.pressMachine, spec.department || formData.department, formData.quantity);
    if (initialOps && initialOps.length > 0) {
      setOperations(initialOps);
      handleFieldChange("operations", initialOps);
    }
    setTabUnsaved(tab.id, true);
    addNotification({
      title: "Mahsulot va Texkarta biriktirildi",
      description: `${spec.code}: ${spec.name} retsepti, xomashyo va marshruti buyurtmaga to'liq yuklandi.`,
      severity: "success",
    });
  };

  const handleSaveAsNewSpec = (specData: {
    code: string;
    name: string;
    department: WorkOrderDepartment;
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
  const { machines: dbMachines, specifications: dbSpecs, sites: dbSites } = useLookupStore();

  const activeSpec = useMemo(
    () =>
      (masterSpecifications || []).find((s) => s.code === formData.recipe) ||
      (dbSpecs && dbSpecs.find((s: any) => s.code === formData.recipe)),
    [masterSpecifications, dbSpecs, formData.recipe]
  );
  const activeSite = useMemo(
    () =>
      (dbSites && dbSites.find((s: any) => s.id === formData.site || s.name === formData.site)) ||
      SITE_OPTIONS.find((s) => s.id === formData.site || s.name === formData.site) || {
        id: formData.site || "site-1",
        name: formData.site || "Bosh sex",
        label: formData.site || "Bosh sex",
        location: "Asosiy bino",
        facilities: "Ishlab chiqarish",
        status: "Active",
      },
    [dbSites, formData.site]
  );
  const activeTech = useMemo(
    () => TECHNOLOGY_OPTIONS.find((t) => t.id === formData.department) || TECHNOLOGY_OPTIONS[0],
    [formData.department]
  );
  const allDbMachines = useMemo(() => {
    if (storeMachines && storeMachines.length > 0) return storeMachines;
    if (dbMachines && dbMachines.length > 0) return dbMachines;
    return [];
  }, [storeMachines, dbMachines]);

  const activeMachine = useMemo(
    () =>
      (allDbMachines && allDbMachines.find((m: any) => m.name === formData.pressMachine || m.code === formData.pressMachine || m.id === formData.pressMachine)) ||
      (formData.pressMachine ? {
        id: "m-custom",
        code: "M-ASSIGNED",
        name: formData.pressMachine,
        department: formData.department,
        speed: "Standart",
        format: "Standart",
        features: "Maxsus uskuna",
        status: "Running",
        isAvailable: true,
      } : undefined),
    [allDbMachines, formData.pressMachine, formData.department]
  );
  const currentDeptMachines = useMemo(
    () => {
      const fromDb = (allDbMachines || []).filter((m: any) => {
        if (!m.department) return false;
        if (m.department.toLowerCase() === formData.department.toLowerCase()) return true;
        return false;
      });
      if (fromDb.length > 0) return fromDb;
      return allDbMachines;
    },
    [allDbMachines, formData.department]
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
      id: "",
      stepNumber: 0,
      name: "Operatsiya kiritilmagan",
      machine: formData.pressMachine || "—",
      operator: "—",
      duration: 0,
      qtyCompleted: "0 / 0",
      status: "Queued" as const,
    };
  }, [operations, selectedTimelineOpId, formData.pressMachine]);

  const selectedOpEvents = useMemo(() => {
    return shiftEvents.filter((ev) => ev.opId === selectedOp.id);
  }, [shiftEvents, selectedOp.id]);

  // Actions
  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    updateTabData(tab.id, { [field]: val });
    setTabUnsaved(tab.id, true);
  };

  const handleSizesChange = (newSizes: SizeDistribution[]) => {
    const total = newSizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const updates = {
      sizes: newSizes,
      ...(newSizes.length > 0 ? { quantity: total } : {}),
    };
    setFormData((prev) => ({
      ...prev,
      ...updates,
    }));
    updateTabData(tab.id, updates);
    setTabUnsaved(tab.id, true);
  };

  const handleDepartmentChange = (newDept: string) => {
    const defaultRecipe = newDept === "Flexo" ? "FLEXO_NYLON_V1" : newDept === "Jacquard" ? "JACQ_WOVEN_V1" : "OFFSET_STD_V1";
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

  const persistOrderDetails = async (): Promise<string> => {
    let currentDocNo = docNo;
    const isCurrentlyDraft = isDraft || !currentDocNo || tab.id.startsWith("draft-") || tab.id.startsWith("temp-");

    if (upsertWorkOrderAsync) {
      const savedResult = await upsertWorkOrderAsync({
        ...formData,
        docNo: isCurrentlyDraft ? undefined : currentDocNo,
        operations,
        sampleData,
        attachments: orderAttachments,
        skuArtworks,
      });

      if (savedResult && typeof savedResult === "object" && savedResult.docNo) {
        currentDocNo = savedResult.docNo;
        setDocNo(currentDocNo);
        if (isCurrentlyDraft) {
          replaceTabId(
            tab.id,
            currentDocNo,
            `${currentDocNo}: ${formData.product || "Yangi buyruq"}`,
            {
              ...data,
              ...formData,
              docNo: currentDocNo,
            }
          );
        }
      }
    }

    const effectiveId = currentDocNo || tab.id;

    updateTabData(
      effectiveId,
      {
        ...data,
        ...formData,
        operations,
        shiftEvents,
        docNo: currentDocNo,
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
        skuArtworks,
      },
      `${effectiveId}: ${formData.product || "Yangi buyruq"}`
    );

    const isSampleNeeded = formData.orderType === "Sample" || Boolean(sampleData?.isRequired);

    upsertProductionQueueItem({
      ...formData,
      id: effectiveId,
      docNo: effectiveId,
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
      orderType: formData.orderType,
      sampleRequired: isSampleNeeded,
      sampleStatus: isSampleNeeded
        ? sampleData.approvalStatus === "approved"
          ? "approved"
          : sampleData.approvalStatus === "revision_requested"
          ? "revision_requested"
          : sampleData.isProduced
          ? "awaiting_approval"
          : "in_production"
        : "none",
      sampleQty: sampleData.sampleQty,
      sampleData,
      operations,
      attachments: orderAttachments,
      skuArtworks,
    });

    setTabUnsaved(effectiveId, false);
    return effectiveId;
  };

  const handleSave = async () => {
    const savedId = await persistOrderDetails();
    addNotification({
      title: "Buyurtma saqlandi",
      description: `${savedId} — ${formData.product || "Buyurtma"} (${formData.customer || "Mijoz"}) muvaffaqiyatli saqlandi.`,
      severity: "success",
    });
  };

  const handleSaveAndClose = async () => {
    const savedId = await persistOrderDetails();
    closeTab(savedId);
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
  const activeTab = (isOperator && rawActiveTab === "financials")
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
          title={formData.product || "Yangi buyruq"}
          docNo={docNo || "Yangi (Avtomatik)"}
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
                        (Namuna: {sampleData.sampleQty} dona)
                      </span>
                    )}
                  </div>
                </InfoRow>

                {/* 1.1 Jami Summa */}
                <InfoRow label="Jami summa">
                  <span className="font-mono font-bold text-foreground">
                    {formatMoney(formData.priceTotal, formData.currency, 0)}
                  </span>
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
                    {formData.colorsConfig || "—"}
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
                badge: formData.width && formData.height ? `${formData.width}×${formData.height}` : null,
              },
              ...(isOffset ? [{ id: "layout", label: tOrder("tabPlanning"), icon: LayoutTemplate }] : []),
              ...(isFlexo ? [{ id: "flexo", label: "Flexo Imposition", icon: Disc }] : []),
              {
                id: "prepress-tooling",
                label: tOrder("tabPrepressTooling") || "Prepress & Jihozlar",
                icon: Stamp,
                badge: (formData.toolingItems || []).length > 0 ? `${(formData.toolingItems || []).length} ta` : null,
                badgeClassName: (formData.toolingItems || []).some((t) => t.status === "Draft" || t.status === "Ordered")
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                  : undefined,
              },
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
              onSelectProductTemplate={handleSelectProductTemplate}
              formData={{ ...formData, skuArtworks }}
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
              materials={currentBomItems}
              operations={operations}
              hasShortage={hasShortage}
              orderAttachments={orderAttachments}
              setOrderAttachments={setOrderAttachments}
              sampleData={sampleData}
              onSampleChange={handleSampleChange}
              onApproveAndReleaseMassRun={handleApproveSampleAndRelease}
              onRejectSample={handleRejectSample}
              onOpenLightbox={() => setIsLightboxOpen(true)}
              onOpenTab={openTab}
              onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              isOperator={isOperator}
              tOrder={tOrder}
            />

            {/* Tab 2: Specifications & Die-Line (Extracted & Enhanced) */}
            <SpecificationsTab
              formData={{ ...formData, skuArtworks }}
              handleFieldChange={handleFieldChange}
              handleSizesChange={handleSizesChange}
              onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
              isOperator={isOperator}
              sampleData={sampleData}
              onSampleChange={handleSampleChange}
              orderAttachments={orderAttachments}
              setOrderAttachments={setOrderAttachments}
              skuArtworks={skuArtworks}
              onSkuArtworksChange={handleSkuArtworksChange}
              docNo={docNo || tab.id}
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

            {/* Tab: Prepress & Tooling (CTP, Klishe, Shtamp) */}
            <TabsContent value="prepress-tooling" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
              <PrepressToolingTab
                formData={formData}
                docNo={data.docNo || tab.id}
                isOperator={isOperator}
                onUpdateTooling={(newItems) => {
                  handleFieldChange("toolingItems", newItems);
                  const totalCost = newItems.reduce(
                    (sum, it) => sum + (it.actualCost !== undefined ? it.actualCost : it.estimatedCost || 0),
                    0
                  );
                  handleFieldChange("toolingProcurementCost", totalCost);
                  handleFieldChange(
                    "toolingProcurementNeeded",
                    newItems.some((it) => it.status === "Draft" || it.status === "Ordered")
                  );

                  // ─── Live Auto-Sync to Production Readiness Gates ───
                  const ctpItems = newItems.filter(
                    (i) => i.category === "ctp_plates" || i.category === "flexo_polymer"
                  );
                  const dieItems = newItems.filter(
                    (i) =>
                      i.category === "die_cutting" ||
                      i.category === "foil_cliche" ||
                      i.category === "emboss_cliche" ||
                      i.category === "varnish_plate"
                  );

                  const platesReady =
                    ctpItems.length > 0
                      ? ctpItems.every((i) => i.status === "Ready")
                      : true;
                  const toolingReady =
                    dieItems.length > 0
                      ? dieItems.every((i) => i.status === "Ready")
                      : true;

                  const targetId = data.docNo || tab.id;
                  if (toggleReadinessCheck) {
                    toggleReadinessCheck(targetId, "platesReady", {
                      forceStatus: platesReady ? "ready" : "pending",
                    });
                    toggleReadinessCheck(targetId, "toolingReady", {
                      forceStatus: toolingReady ? "ready" : "pending",
                    });
                  }

                  handleFieldChange("checks", {
                    ...((formData as any).checks || {}),
                    platesReady,
                    toolingReady,
                  });
                }}
                onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
              />
            </TabsContent>

            {/* Tab 3: Materials BOM */}
            <MaterialsTab
              tabId={tab.id}
              department={formData.department}
              recipe={formData.recipe}
              activeSpec={activeSpec}
              initialItems={currentBomItems}
              onRecipeChange={(code, dept) => {
                handleFieldChange("recipe", code);
                if (dept && formData.department !== dept) {
                  handleDepartmentChange(dept);
                }
              }}
              onOpenTab={openTab}
              isOperator={isOperator}
              onItemsChange={(newItems) => {
                setCurrentBomItems(newItems);
                handleFieldChange("materials", newItems);
              }}
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
              onOpenQuickPalletLog={handleOpenLogEvent}
              onChangeStepStatus={(opId, status) => {
                setOperations((prev) =>
                  prev.map((op) => (op.id === opId ? { ...op, status } : op))
                );
                setTabUnsaved(tab.id, true);
              }}
            />

            {/* Tab 6: Financials (Hidden for Operators) */}
            {!isOperator && (
              <FinancialsTab
                shiftEvents={shiftEvents}
                formData={{ ...formData, skuArtworks }}
                printPlan={activePrintPlan}
                operations={operations}
                materials={currentBomItems}
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
              onFileUploaded={(newAtt) => {
                if (newAtt.isImage) {
                  if (!formData.photoUrl) {
                    handleFieldChange("photoUrl", newAtt.url);
                  }
                  if (!formData.photoUrls || formData.photoUrls.length === 0) {
                    handleFieldChange("photoUrls", [newAtt.url]);
                  }
                  if (!formData.artworkFront) {
                    handleFieldChange("artworkFront", newAtt.url);
                  }
                }
              }}
            />

            {/* Tab 8: History */}
            <HistoryTab
              docNo={data.docNo || tab.id}
              formData={{ ...formData, skuArtworks }}
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
        formData={{ ...formData, skuArtworks }}
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
        src={getDisplayImageUrl(formData.photoUrl)}
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
