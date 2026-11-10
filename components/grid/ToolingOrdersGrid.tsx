"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { useWorkspaceStore, ProductionQueueItem } from "@/store/workspaceStore";
import { ToolingOrderRecord } from "@/lib/server/supplierService";
import { getInitialToolingItems } from "@/components/documents/work-order/WorkOrderDetail";
import { WorkOrderToolingItem } from "@/components/documents/work-order/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Stamp,
  Search,
  Plus,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
  Truck,
  ExternalLink,
  Layers,
  Wrench,
  Sparkles,
  Lock,
  Upload,
  Send,
  MessageSquare,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

const ORDER_TYPE_LABELS: Record<string, string> = {
  ctp_plates: "CTP Metall Forma",
  flexo_polymer: "Flexo Polimer Forma",
  die_tooling: "Kesish Shtansformasi",
  cliche: "Folga / Klishe",
  outsourcing: "Autsorsing xizmati",
  raw_materials: "Material xaridi",
  service: "Texnik servis",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  Draft: "Qoralama",
  Ordered: "Buyurtma berildi",
  In_Production: "Ishlab chiqarilmoqda",
  Ready: "Tayyor",
  Delivered: "Yetkazildi",
  Cancelled: "Bekor qilindi",
};

export function ToolingOrdersGrid() {
  const {
    theme,
    suppliers,
    loadSuppliers,
    productionQueue,
    loadProductionQueue,
    openTab,
    toggleReadinessCheck,
    addNotification,
    tabs,
    activeTabId,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const [orders, setOrders] = useState<ToolingOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"orders" | "deficits">("orders");

  // Automatic filter & view mode when opened from Work Order
  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);
  useEffect(() => {
    if (activeTab?.documentData?.viewMode) {
      setViewMode(activeTab.documentData.viewMode);
    }
    if (activeTab?.documentData?.workOrderNo) {
      setSearchQuery(activeTab.documentData.workOrderNo);
    }
  }, [activeTab]);

  // Selection
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [deficitGridSelection, setDeficitGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ToolingOrderRecord | null>(null);
  const [fileError, setFileError] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Hover Magnified Image Preview
  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    x: number;
    y: number;
    title?: string;
    subtitle?: string;
  } | null>(null);
  const mouseCoordsRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const getCursorCardPosition = useCallback(
    (clientX: number, clientY: number, cardWidth = 340, cardHeight = 340) => {
      const margin = 16;
      const vpW = typeof window !== "undefined" ? window.innerWidth : 1920;
      const vpH = typeof window !== "undefined" ? window.innerHeight : 1080;

      let x = clientX + margin;
      let y = clientY + margin;

      if (x + cardWidth > vpW - margin) {
        x = clientX - cardWidth - margin;
      }
      if (y + cardHeight > vpH - margin) {
        y = clientY - cardHeight - margin;
      }
      if (x < margin) x = margin;
      if (y < margin) y = margin;

      return { x, y };
    },
    []
  );

  // Find real Work Order photographic proof / artwork
  const getWorkOrderImage = useCallback(
    (workOrderNo?: string, directImageUrl?: string): string | null => {
      if (directImageUrl && typeof directImageUrl === "string" && directImageUrl.trim().length > 0) {
        return directImageUrl.trim();
      }
      if (!workOrderNo) return null;
      const cleanNo = workOrderNo.trim().toLowerCase();
      const wo = (productionQueue || []).find((q) =>
        (q.id && q.id.trim().toLowerCase() === cleanNo) ||
        (q.docNo && q.docNo.trim().toLowerCase() === cleanNo) ||
        (cleanNo.includes((q.id || "").toLowerCase()) && (q.id || "").length > 3)
      );
      if (!wo) return null;
      if (wo.photoUrl && typeof wo.photoUrl === "string" && wo.photoUrl.trim().length > 0) {
        return wo.photoUrl.trim();
      }
      if (
        Array.isArray(wo.photoUrls) &&
        wo.photoUrls.length > 0 &&
        typeof wo.photoUrls[0] === "string" &&
        wo.photoUrls[0].trim().length > 0
      ) {
        return wo.photoUrls[0].trim();
      }
      if (Array.isArray(wo.attachments) && wo.attachments.length > 0) {
        const imgAtt = wo.attachments.find(
          (a: any) =>
            a &&
            a.url &&
            (a.fileType === "image" ||
              /\.(png|jpe?g|webp|gif|svg)$/i.test(a.url || a.fileName || ""))
        );
        if (imgAtt?.url) return imgAtt.url;
      }
      return null;
    },
    [productionQueue]
  );

  const [formData, setFormData] = useState({
    supplierId: "",
    orderType: "ctp_plates" as ToolingOrderRecord["orderType"],
    title: "",
    workOrderNo: "",
    quantity: 1,
    unit: "dona",
    amount: 0,
    currency: "UZS",
    deliveryDeadline: new Date().toISOString().split("T")[0],
    specDetails: "",
    notes: "",
    status: "Ordered" as ToolingOrderRecord["status"],
    fileUrl: "" as string | undefined,
    fileName: "" as string | undefined,
    imageUrl: "" as string | undefined,
  });

  // Load orders from API
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/production/tooling-orders");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrders(json.data);
      }
    } catch (err) {
      console.error("Failed to load tooling orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    if (loadSuppliers) loadSuppliers();
    if (loadProductionQueue) loadProductionQueue();
  }, [fetchOrders, loadSuppliers, loadProductionQueue]);

  // Compute Deficit Rows from productionQueue using actual work order tooling items
  const deficitRows = useMemo(() => {
    const list: Array<{
      id: string;
      workOrderId: string;
      customer: string;
      product: string;
      neededTooling: string;
      specDetails?: string;
      quantity: number;
      unit: string;
      toolingCategory: ToolingOrderRecord["orderType"];
      deadline?: string;
      status: "Deficit";
      estimatedCost?: number;
      currency?: string;
      fileUrl?: string;
      fileName?: string;
      imageUrl?: string;
    }> = [];

    productionQueue.forEach((q) => {
      if (q.stage === "Completed") return;

      const items: WorkOrderToolingItem[] =
        Array.isArray(q.toolingItems) && q.toolingItems.length > 0
          ? q.toolingItems
          : getInitialToolingItems(q as any, q.id || q.docNo || "");

      items.forEach((item) => {
        // If already ready, mounted or delivered, it is not a deficit
        if (item.status === "Ready" || item.status === "Delivered" || item.status === "Mounted") {
          return;
        }

        // Map category to supplier orderType
        let orderType: ToolingOrderRecord["orderType"] = "ctp_plates";
        if (item.category === "die_cutting") orderType = "die_tooling";
        else if (item.category === "foil_cliche" || item.category === "emboss_cliche") orderType = "cliche";
        else if (item.category === "varnish_plate") orderType = "outsourcing";

        // Check if an order has already been placed in supplierOrders (orders state)
        const isAlreadyOrdered = orders.some((o) => {
          if (!o.workOrderNo) return false;
          const matchWo = o.workOrderNo.trim().toLowerCase() === (q.id || q.docNo || "").trim().toLowerCase();
          const matchType = o.orderType === orderType;
          return matchWo && matchType && o.status !== "Cancelled";
        });

        if (!isAlreadyOrdered) {
          list.push({
            id: `DEF-${q.id}-${item.id || item.category}`,
            workOrderId: q.id || q.docNo || "",
            customer: q.customer || "—",
            product: q.product || "Mahsulot",
            neededTooling: item.name,
            specDetails: item.specDetails,
            quantity: item.quantity || 1,
            unit: item.unit || "dona",
            toolingCategory: orderType,
            deadline: q.deadline,
            status: "Deficit",
            estimatedCost: item.estimatedCost,
            currency: item.currency || q.currency || "UZS",
            fileUrl: item.fileUrl || undefined,
            fileName: item.fileName || undefined,
            imageUrl:
              item.imageUrl ||
              q.photoUrl ||
              (Array.isArray(q.photoUrls) && q.photoUrls.length > 0 ? q.photoUrls[0] : undefined),
          });
        }
      });
    });

    return list;
  }, [productionQueue, orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedType !== "all" && o.orderType !== selectedType) return false;
      if (selectedStatus !== "all" && o.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNo = o.orderNo?.toLowerCase().includes(query);
        const matchesWo = o.workOrderNo?.toLowerCase().includes(query);
        const matchesTitle = o.title?.toLowerCase().includes(query);
        const matchesSupp = o.supplierName?.toLowerCase().includes(query);
        if (!matchesNo && !matchesWo && !matchesTitle && !matchesSupp) return false;
      }
      return true;
    });
  }, [orders, selectedType, selectedStatus, searchQuery]);

  // KPI calculations
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const inTransitCount = orders.filter(
      (o) => o.status === "Ordered" || o.status === "In_Production"
    ).length;
    const todayStr = new Date().toISOString().split("T")[0];
    const dueTodayCount = orders.filter(
      (o) =>
        (o.status === "Ordered" || o.status === "In_Production") &&
        o.deliveryDeadline === todayStr
    ).length;
    const readyCount = orders.filter(
      (o) => o.status === "Ready" || o.status === "Delivered"
    ).length;
    const totalSum = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const deficitCount = deficitRows.length;

    return {
      totalCount,
      inTransitCount,
      dueTodayCount,
      readyCount,
      totalSum,
      deficitCount,
    };
  }, [orders, deficitRows]);

  // Columns definition
  const columns: GridColumn[] = useMemo(() => {
    return [
      { id: "orderNo", title: "PO №", width: 115, icon: GridColumnIcon.HeaderReference },
      { id: "image", title: "Rasm", width: 68, icon: GridColumnIcon.HeaderImage },
      { id: "workOrderNo", title: "Ish buyurtmasi №", width: 130, icon: GridColumnIcon.HeaderReference },
      { id: "orderType", title: "Jihoz turi", width: 155, icon: GridColumnIcon.HeaderSingleValue },
      { id: "title", title: "Jihoz / Buyurtma nomi", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "supplierName", title: "Yetkazib beruvchi", width: 190, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Miqdor", width: 85, icon: GridColumnIcon.HeaderNumber },
      { id: "amount", title: "Summa", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "orderDate", title: "Buyurtma sanasi", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "deliveryDeadline", title: "Yetkazish muddati", width: 120, icon: GridColumnIcon.HeaderDate },
      { id: "status", title: "Holati", width: 125, icon: GridColumnIcon.HeaderSingleValue },
      { id: "specDetails", title: "Texnik parametrlar", width: 230, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 180, icon: GridColumnIcon.HeaderString },
    ];
  }, []);

  // Cell Content Provider
  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const order = filteredOrders[row];
      if (!order) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      const colDef = columns[col];
      const colId = colDef.id;

      if (colId === "orderNo") {
        return {
          kind: GridCellKind.Text,
          data: order.orderNo,
          displayData: order.orderNo,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (colId === "image") {
        const img = getWorkOrderImage(order.workOrderNo, order.imageUrl);
        const data = img ? [img] : [];
        return {
          kind: GridCellKind.Image,
          data,
          displayData: data,
          allowOverlay: false,
          rounding: 4,
          contentAlign: "center",
        };
      }

      if (colId === "orderType") {
        const label = ORDER_TYPE_LABELS[order.orderType] || order.orderType;
        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
        };
      }

      if (colId === "title") {
        return {
          kind: GridCellKind.Text,
          data: order.title || "",
          displayData: order.title || "",
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "500 12px sans-serif",
          },
        };
      }

      if (colId === "workOrderNo") {
        const wo = order.workOrderNo || "—";
        return {
          kind: GridCellKind.Text,
          data: wo,
          displayData: wo,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: wo !== "—" ? "bold 12px monospace" : "12px sans-serif",
            textDark: wo !== "—" ? (isDark ? "#60a5fa" : "#2563eb") : undefined,
          },
        };
      }

      if (colId === "supplierName") {
        return {
          kind: GridCellKind.Text,
          data: order.supplierName || "—",
          displayData: order.supplierName || "—",
          allowOverlay: false,
        };
      }

      if (colId === "quantity") {
        const qStr = `${order.quantity || 1} ${order.unit || "dona"}`;
        return {
          kind: GridCellKind.Text,
          data: qStr,
          displayData: qStr,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "12px monospace",
          },
        };
      }

      if (colId === "amount") {
        const formatted = `${(order.amount || 0).toLocaleString("uz-UZ")} ${order.currency || "UZS"}`;
        return {
          kind: GridCellKind.Text,
          data: formatted,
          displayData: formatted,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (colId === "orderDate") {
        return {
          kind: GridCellKind.Text,
          data: order.orderDate || "",
          displayData: order.orderDate || "",
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            baseFontStyle: "11px monospace",
          },
        };
      }

      if (colId === "deliveryDeadline") {
        const dl = order.deliveryDeadline || "—";
        const todayStr = new Date().toISOString().split("T")[0];
        const isUrgent = dl === todayStr && (order.status === "Ordered" || order.status === "In_Production");
        return {
          kind: GridCellKind.Text,
          data: dl,
          displayData: dl,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            baseFontStyle: "11px monospace",
            textDark: isUrgent ? (isDark ? "#f87171" : "#dc2626") : undefined,
          },
        };
      }

      if (colId === "status") {
        const label = ORDER_STATUS_LABELS[order.status] || order.status;
        let color = isDark ? "#a1a1aa" : "#71717a";
        if (order.status === "Ready" || order.status === "Delivered") {
          color = isDark ? "#4ade80" : "#15803d";
        } else if (order.status === "Ordered" || order.status === "In_Production") {
          color = isDark ? "#60a5fa" : "#2563eb";
        } else if (order.status === "Cancelled") {
          color = isDark ? "#f87171" : "#dc2626";
        }
        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (colId === "specDetails") {
        return {
          kind: GridCellKind.Text,
          data: order.specDetails || "—",
          displayData: order.specDetails || "—",
          allowOverlay: false,
        };
      }

      if (colId === "notes") {
        return {
          kind: GridCellKind.Text,
          data: order.notes || "—",
          displayData: order.notes || "—",
          allowOverlay: false,
        };
      }

      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: false,
      };
    },
    [filteredOrders, columns, isDark, getWorkOrderImage]
  );

  // Selected row
  const selectedOrder = useMemo(() => {
    const rowIndex = gridSelection.current?.cell
      ? gridSelection.current.cell[1]
      : gridSelection.rows.toArray()[0] ?? -1;
    if (rowIndex < 0 || rowIndex >= filteredOrders.length) return null;
    return filteredOrders[rowIndex] || null;
  }, [gridSelection, filteredOrders]);

  // Deficit Columns definition
  const deficitColumns: GridColumn[] = useMemo(() => {
    return [
      { id: "image", title: "Rasm", width: 68, icon: GridColumnIcon.HeaderImage },
      { id: "workOrderId", title: "Ish buyurtmasi №", width: 135, icon: GridColumnIcon.HeaderReference },
      { id: "customer", title: "Mijoz", width: 175, icon: GridColumnIcon.HeaderString },
      { id: "product", title: "Mahsulot", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "orderType", title: "Jihoz toifasi", width: 155, icon: GridColumnIcon.HeaderSingleValue },
      { id: "neededTooling", title: "Talab qilingan jihoz", width: 250, icon: GridColumnIcon.HeaderString },
      { id: "specDetails", title: "Spetsifikatsiya / Format", width: 220, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Miqdor", width: 85, icon: GridColumnIcon.HeaderNumber },
      { id: "estimatedCost", title: "Taxminiy narx", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "deadline", title: "Chop etish muddati", width: 125, icon: GridColumnIcon.HeaderDate },
      { id: "status", title: "Holat", width: 110, icon: GridColumnIcon.HeaderSingleValue },
    ];
  }, []);

  const filteredDeficitRows = useMemo(() => {
    return deficitRows.filter((d) => {
      if (selectedType !== "all" && d.toolingCategory !== selectedType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesWo = d.workOrderId.toLowerCase().includes(query);
        const matchesCust = d.customer.toLowerCase().includes(query);
        const matchesProd = d.product.toLowerCase().includes(query);
        const matchesTool = d.neededTooling.toLowerCase().includes(query);
        if (!matchesWo && !matchesCust && !matchesProd && !matchesTool) return false;
      }
      return true;
    });
  }, [deficitRows, selectedType, searchQuery]);

  const selectedDeficit = useMemo(() => {
    const rowIndex = deficitGridSelection.current?.cell
      ? deficitGridSelection.current.cell[1]
      : deficitGridSelection.rows.toArray()[0] ?? -1;
    if (rowIndex < 0 || rowIndex >= filteredDeficitRows.length) return null;
    return filteredDeficitRows[rowIndex] || null;
  }, [deficitGridSelection, filteredDeficitRows]);

  const getDeficitCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const def = filteredDeficitRows[row];
      if (!def) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      const colDef = deficitColumns[col];
      const colId = colDef.id;

      if (colId === "image") {
        const img = def.imageUrl || getWorkOrderImage(def.workOrderId);
        const data = img ? [img] : [];
        return {
          kind: GridCellKind.Image,
          data,
          displayData: data,
          allowOverlay: false,
          rounding: 4,
          contentAlign: "center",
        };
      }

      if (colId === "workOrderId") {
        return {
          kind: GridCellKind.Text,
          data: def.workOrderId,
          displayData: def.workOrderId,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "bold 12px monospace",
            textDark: isDark ? "#60a5fa" : "#2563eb",
          },
        };
      }

      if (colId === "customer") {
        return {
          kind: GridCellKind.Text,
          data: def.customer,
          displayData: def.customer,
          allowOverlay: false,
        };
      }

      if (colId === "product") {
        return {
          kind: GridCellKind.Text,
          data: def.product,
          displayData: def.product,
          allowOverlay: false,
        };
      }

      if (colId === "orderType") {
        const label = ORDER_TYPE_LABELS[def.toolingCategory] || def.toolingCategory;
        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
        };
      }

      if (colId === "neededTooling") {
        return {
          kind: GridCellKind.Text,
          data: def.neededTooling,
          displayData: def.neededTooling,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "500 12px sans-serif",
          },
        };
      }

      if (colId === "specDetails") {
        return {
          kind: GridCellKind.Text,
          data: def.specDetails || "—",
          displayData: def.specDetails || "—",
          allowOverlay: false,
        };
      }

      if (colId === "quantity") {
        const qStr = `${def.quantity || 1} ${def.unit || "dona"}`;
        return {
          kind: GridCellKind.Text,
          data: qStr,
          displayData: qStr,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "12px monospace",
          },
        };
      }

      if (colId === "estimatedCost") {
        const formatted = def.estimatedCost
          ? `${def.estimatedCost.toLocaleString("uz-UZ")} ${def.currency || "UZS"}`
          : "—";
        return {
          kind: GridCellKind.Text,
          data: formatted,
          displayData: formatted,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "12px monospace",
          },
        };
      }

      if (colId === "deadline") {
        const dl = def.deadline || "—";
        const todayStr = new Date().toISOString().split("T")[0];
        const isUrgent = dl === todayStr;
        return {
          kind: GridCellKind.Text,
          data: dl,
          displayData: dl,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            baseFontStyle: "11px monospace",
            textDark: isUrgent ? (isDark ? "#f87171" : "#dc2626") : undefined,
          },
        };
      }

      if (colId === "status") {
        return {
          kind: GridCellKind.Text,
          data: "Taqchillik",
          displayData: "Taqchillik",
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            textDark: isDark ? "#f87171" : "#dc2626",
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: false,
      };
    },
    [filteredDeficitRows, deficitColumns, isDark, getWorkOrderImage]
  );

  // Hover Callbacks for Magnified Image Preview
  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind === "cell") {
        const [col, row] = args.location;
        const colDef = columns[col];
        if (colDef?.id === "image") {
          const order = filteredOrders[row];
          if (order) {
            const img = getWorkOrderImage(order.workOrderNo, order.imageUrl);
            if (img) {
              const { x, y } = getCursorCardPosition(
                mouseCoordsRef.current.x,
                mouseCoordsRef.current.y
              );
              setHoveredPreview({
                url: img,
                x,
                y,
                title: order.title,
                subtitle: order.workOrderNo ? `Ish buyurtmasi: ${order.workOrderNo}` : undefined,
              });
              return;
            }
          }
        }
      }
      setHoveredPreview(null);
    },
    [columns, filteredOrders, getWorkOrderImage, getCursorCardPosition]
  );

  const onDeficitItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind === "cell") {
        const [col, row] = args.location;
        const colDef = deficitColumns[col];
        if (colDef?.id === "image") {
          const def = filteredDeficitRows[row];
          if (def) {
            const img = def.imageUrl || getWorkOrderImage(def.workOrderId);
            if (img) {
              const { x, y } = getCursorCardPosition(
                mouseCoordsRef.current.x,
                mouseCoordsRef.current.y
              );
              setHoveredPreview({
                url: img,
                x,
                y,
                title: def.neededTooling,
                subtitle: `${def.workOrderId} • ${def.product}`,
              });
              return;
            }
          }
        }
      }
      setHoveredPreview(null);
    },
    [deficitColumns, filteredDeficitRows, getWorkOrderImage, getCursorCardPosition]
  );

  // Download attached CAD/PDF file
  const handleDownloadAttachment = (fileUrl?: string, fileName?: string) => {
    const name = fileName || `${formData.workOrderNo || "tooling"}_chizma.dxf`;
    if (fileUrl && (fileUrl.startsWith("http") || fileUrl.startsWith("data:"))) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = name;
      a.click();
      return;
    }
    const isPdf = name.toLowerCase().endsWith(".pdf");
    const content = isPdf
      ? `%PDF-1.4\n% PrintGoo ERP Tooling CAD Specification\n% Order: ${formData.workOrderNo || "WO"}\n% Tool: ${formData.title}\n% Specs: ${formData.specDetails || "N/A"}`
      : `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n999\nPrintGoo ERP Die Tooling: ${formData.title}\n0\nENDSEC\n0\nEOF`;
    const blob = new Blob([content], { type: isPdf ? "application/pdf" : "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload/replace CAD or image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setFormData((prev) => ({
          ...prev,
          fileUrl: dataUrl,
          fileName: file.name,
          imageUrl: isImg ? dataUrl : prev.imageUrl,
        }));
        setFileError(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Open edit / create modal
  const handleOpenCreateModal = (preset?: Partial<typeof formData>) => {
    setFileError(false);
    setEditingOrder(null);
    setFormData({
      supplierId: suppliers[0]?.id || "",
      orderType: "ctp_plates",
      title: "",
      workOrderNo: "",
      quantity: 1,
      unit: "dona",
      amount: 0,
      currency: "UZS",
      deliveryDeadline: new Date().toISOString().split("T")[0],
      specDetails: "",
      notes: "",
      status: "Ordered",
      fileUrl: undefined,
      fileName: undefined,
      imageUrl: undefined,
      ...preset,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (order: ToolingOrderRecord) => {
    setFileError(false);
    setEditingOrder(order);
    const matchingQueueItem = productionQueue.find(
      (q) => (q.id || q.docNo || "").trim().toLowerCase() === (order.workOrderNo || "").trim().toLowerCase()
    );
    const matchingTool = matchingQueueItem?.toolingItems?.find(
      (t: any) =>
        (t.name && order.title && t.name.toLowerCase() === order.title.toLowerCase()) ||
        t.category === order.orderType
    );

    setFormData({
      supplierId: order.supplierId,
      orderType: order.orderType,
      title: order.title,
      workOrderNo: order.workOrderNo || "",
      quantity: order.quantity || 1,
      unit: order.unit || "dona",
      amount: order.amount || 0,
      currency: order.currency || "UZS",
      deliveryDeadline: order.deliveryDeadline || new Date().toISOString().split("T")[0],
      specDetails: order.specDetails || "",
      notes: order.notes || "",
      status: order.status,
      fileUrl: matchingTool?.fileUrl || undefined,
      fileName: matchingTool?.fileName || undefined,
      imageUrl: matchingTool?.imageUrl || undefined,
    });
    setIsModalOpen(true);
  };

  // Submit order to API
  const handleSaveOrder = async () => {
    if (!formData.supplierId || !formData.title.trim()) {
      addNotification({
        title: "To'ldirilmagan maydonlar",
        description: "Iltimos, ta'minotchi va jihoz nomini kiriting!",
        severity: "error",
      });
      return;
    }

    // Validation: tooling orders must have an attached file if placing an active order (status !== Draft)
    const isDraft = formData.status === "Draft";
    const hasFile = Boolean(formData.fileUrl || formData.fileName);
    if (!isDraft && !hasFile) {
      setFileError(true);
      addNotification({
        title: "Fayl biriktirilmagan",
        description: "Buyurtma berish uchun jihoz chizma fayli (PDF/DXF/AI) yuklanishi shart",
        severity: "error",
      });
      return;
    }

    try {
      const payload = {
        ...(editingOrder ? { id: editingOrder.id, orderNo: editingOrder.orderNo } : {}),
        ...formData,
      };

      const res = await fetch("/api/v1/production/tooling-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addNotification({
          title: editingOrder ? "Buyurtma yangilandi" : "Yangi jihoz buyurtmasi yaratildi",
          description: `${formData.title} muvaffaqiyatli saqlandi`,
          severity: "success",
        });

        // Bidirectional sync with Work Order toolingItems in workspace store
        if (formData.workOrderNo) {
          const queue = useWorkspaceStore.getState().productionQueue;
          const woKey = formData.workOrderNo.trim().toLowerCase();
          const targetQ = queue.find(
            (q) => (q.id || q.docNo || "").trim().toLowerCase() === woKey
          );

          if (targetQ) {
            const currentTools: WorkOrderToolingItem[] =
              Array.isArray(targetQ.toolingItems) && targetQ.toolingItems.length > 0
                ? targetQ.toolingItems
                : getInitialToolingItems(targetQ as any, targetQ.id || targetQ.docNo || "");

            const chosenSupplier = suppliers.find((s) => s.id === formData.supplierId);
            const poNo = json.data?.orderNo || editingOrder?.orderNo;

            const updatedTools = currentTools.map((t) => {
              const isMatch =
                (t.name && formData.title && t.name.toLowerCase() === formData.title.toLowerCase()) ||
                (t.category && formData.orderType && (
                  (formData.orderType === "ctp_plates" && (t.category === "ctp_plates" || t.category === "flexo_polymer")) ||
                  (formData.orderType === "die_tooling" && t.category === "die_cutting") ||
                  (formData.orderType === "cliche" && (t.category === "foil_cliche" || t.category === "emboss_cliche"))
                ));

              if (isMatch) {
                return {
                  ...t,
                  supplierName: chosenSupplier?.name || t.supplierName,
                  purchaseOrderNo: poNo || t.purchaseOrderNo,
                  status: (formData.status === "Ready" || formData.status === "Delivered")
                    ? "Ready"
                    : formData.status === "Draft"
                    ? "Draft"
                    : "Ordered",
                  fileUrl: formData.fileUrl || t.fileUrl,
                  fileName: formData.fileName || t.fileName,
                  imageUrl: formData.imageUrl || t.imageUrl,
                } as WorkOrderToolingItem;
              }
              return t;
            });

            useWorkspaceStore.getState().upsertProductionQueueItem({
              id: targetQ.id,
              toolingItems: updatedTools,
            });

            // Sync any open Work Order tab
            const allTabs = useWorkspaceStore.getState().tabs;
            const openWoTab = allTabs.find(
              (t) =>
                t.id.toLowerCase() === woKey ||
                (t.documentData && (t.documentData.docNo?.toLowerCase() === woKey || t.documentData.id?.toLowerCase() === woKey))
            );
            if (openWoTab) {
              useWorkspaceStore.getState().updateTabData(openWoTab.id, {
                toolingItems: updatedTools,
              });
            }
          }

          if (formData.status === "Ready" || formData.status === "Delivered") {
            const woUpper = formData.workOrderNo.trim().toUpperCase();
            if (formData.orderType === "ctp_plates") {
              toggleReadinessCheck(woUpper, "platesReady", { forceStatus: "ready" });
            } else if (formData.orderType === "die_tooling" || formData.orderType === "cliche") {
              toggleReadinessCheck(woUpper, "toolingReady", { forceStatus: "ready" });
            }
          }
        }

        setIsModalOpen(false);
        fetchOrders();
      } else {
        alert(json.error || "Xatolik yuz berdi");
      }
    } catch (err) {
      console.error("Save tooling order error:", err);
      alert("Buyurtmani saqlashda xatolik yuz berdi");
    }
  };

  // Quick Status Change (Ready / Delivered / etc.)
  const handleUpdateStatus = async (order: ToolingOrderRecord, newStatus: ToolingOrderRecord["status"]) => {
    try {
      const res = await fetch("/api/v1/production/tooling-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          supplierId: order.supplierId,
          orderNo: order.orderNo,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Holat yangilandi",
          description: `${order.orderNo}: ${ORDER_STATUS_LABELS[newStatus]}`,
          severity: "info",
        });

        // Bidirectional sync with Work Order toolingItems & readiness checks
        if (order.workOrderNo) {
          const woKey = order.workOrderNo.trim().toLowerCase();
          const queue = useWorkspaceStore.getState().productionQueue;
          const targetQ = queue.find(
            (q) => (q.id || q.docNo || "").trim().toLowerCase() === woKey
          );

          if (targetQ) {
            const currentTools: WorkOrderToolingItem[] =
              Array.isArray(targetQ.toolingItems) && targetQ.toolingItems.length > 0
                ? targetQ.toolingItems
                : getInitialToolingItems(targetQ as any, targetQ.id || targetQ.docNo || "");

            const nextToolStatus =
              newStatus === "Ready" || newStatus === "Delivered"
                ? "Ready"
                : newStatus === "Cancelled"
                ? "Draft"
                : "Ordered";

            const updatedTools = currentTools.map((t) => {
              const isMatch =
                (t.purchaseOrderNo && order.orderNo && t.purchaseOrderNo === order.orderNo) ||
                (t.name && order.title && t.name.toLowerCase() === order.title.toLowerCase()) ||
                (t.category && order.orderType && (
                  (order.orderType === "ctp_plates" && (t.category === "ctp_plates" || t.category === "flexo_polymer")) ||
                  (order.orderType === "die_tooling" && t.category === "die_cutting") ||
                  (order.orderType === "cliche" && (t.category === "foil_cliche" || t.category === "emboss_cliche"))
                ));

              if (isMatch) {
                return {
                  ...t,
                  status: nextToolStatus,
                } as WorkOrderToolingItem;
              }
              return t;
            });

            useWorkspaceStore.getState().upsertProductionQueueItem({
              id: targetQ.id,
              toolingItems: updatedTools,
            });

            const allTabs = useWorkspaceStore.getState().tabs;
            const openWoTab = allTabs.find(
              (t) =>
                t.id.toLowerCase() === woKey ||
                (t.documentData && (t.documentData.docNo?.toLowerCase() === woKey || t.documentData.id?.toLowerCase() === woKey))
            );
            if (openWoTab) {
              useWorkspaceStore.getState().updateTabData(openWoTab.id, {
                toolingItems: updatedTools,
              });
            }
          }

          const woUpper = order.workOrderNo.trim().toUpperCase();
          if (newStatus === "Ready" || newStatus === "Delivered") {
            if (order.orderType === "ctp_plates") {
              toggleReadinessCheck(woUpper, "platesReady", { forceStatus: "ready" });
            } else if (order.orderType === "die_tooling" || order.orderType === "cliche") {
              toggleReadinessCheck(woUpper, "toolingReady", { forceStatus: "ready" });
            }
          }
        }

        fetchOrders();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Telegram guruhga buyurtma (PO) yuborish
  const handleSendToTelegram = async (order: ToolingOrderRecord) => {
    try {
      const res = await fetch(
        `/api/v1/production/tooling-orders/${encodeURIComponent(order.id)}/send-telegram`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: order.fileUrl,
            fileName: order.fileName,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Telegramga yuborildi",
          description: `${order.orderNo} ta'minotchi guruhiga inline tugmalar bilan jo'natildi.`,
          severity: "success",
        });
        fetchOrders();
      } else {
        addNotification({
          title: "Yuborilmadi",
          description: json.error || "Guruhga yuborishda xatolik",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("handleSendToTelegram error:", err);
      addNotification({
        title: "Xatolik",
        description: "Aloqa uzildi",
        severity: "error",
      });
    }
  };

  // Open linked Work Order
  const handleOpenWorkOrder = (woNo?: string) => {
    if (!woNo) return;
    openTab({
      id: woNo,
      title: `${woNo}: Buyurtma`,
      type: "work-order",
      module: "production",
    });
  };

  // Open linked Supplier
  const handleOpenSupplier = (suppId?: string) => {
    if (!suppId) return;
    const supp = suppliers.find((s) => s.id === suppId);
    openTab({
      id: suppId,
      title: `${supp?.code || suppId}: ${supp?.name || "Ta'minotchi"}`,
      type: "supplier",
      module: "crm",
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* 1. Industrial KPI Metric Ribbon */}
      <div className="border-b border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <Stamp className="size-4 text-primary" />
            <span>Qolip va CTP buyurtmalari</span>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Quick Tabs: Placed Orders vs Pending Deficits */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded border border-border">
            <Button
              variant={viewMode === "orders" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-xs rounded-sm gap-1.5"
              onClick={() => setViewMode("orders")}
            >
              <span>Buyurtmalar</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-mono">
                {stats.totalCount}
              </Badge>
            </Button>
            <Button
              variant={viewMode === "deficits" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-xs rounded-sm gap-1.5"
              onClick={() => setViewMode("deficits")}
            >
              <AlertTriangle className="size-3 text-amber-500" />
              <span>Ehtiyojlar</span>
              {stats.deficitCount > 0 && (
                <Badge variant="destructive" className="px-1 py-0 h-4 text-[10px] font-mono">
                  {stats.deficitCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground font-medium"
            onClick={() => {
              if (viewMode === "deficits" && selectedDeficit) {
                handleOpenCreateModal({
                  workOrderNo: selectedDeficit.workOrderId,
                  title: selectedDeficit.neededTooling,
                  orderType: selectedDeficit.toolingCategory,
                  quantity: selectedDeficit.quantity,
                  unit: selectedDeficit.unit,
                  amount: selectedDeficit.estimatedCost || 0,
                  currency: selectedDeficit.currency || "UZS",
                  specDetails: selectedDeficit.specDetails || "",
                  deliveryDeadline: selectedDeficit.deadline || new Date().toISOString().split("T")[0],
                  fileUrl: selectedDeficit.fileUrl,
                  fileName: selectedDeficit.fileName,
                  imageUrl: selectedDeficit.imageUrl,
                });
              } else if (deficitRows.length > 0) {
                const def = deficitRows[0];
                handleOpenCreateModal({
                  workOrderNo: def.workOrderId,
                  title: def.neededTooling,
                  orderType: def.toolingCategory,
                  quantity: def.quantity,
                  unit: def.unit,
                  amount: def.estimatedCost || 0,
                  currency: def.currency || "UZS",
                  specDetails: def.specDetails || "",
                  deliveryDeadline: def.deadline || new Date().toISOString().split("T")[0],
                  fileUrl: def.fileUrl,
                  fileName: def.fileName,
                  imageUrl: def.imageUrl,
                });
              } else {
                handleOpenCreateModal();
              }
            }}
          >
            <Plus className="size-3.5" />
            <span>
              {viewMode === "deficits" && selectedDeficit
                ? `Buyurtma berish (${selectedDeficit.workOrderId})`
                : "Buyurtma berish"}
            </span>
          </Button>

          {viewMode === "orders" && selectedOrder && (selectedOrder.status === "Ordered" || selectedOrder.status === "In_Production") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleUpdateStatus(selectedOrder, "Ready")}
            >
              <CheckCircle2 className="size-3.5" />
              <span>Tayyor deb belgilash</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 px-2.5"
            onClick={fetchOrders}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Yangilash</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-xs shrink-0">
        <div className="flex items-center justify-between border border-border bg-card px-2.5 py-1.5 rounded">
          <span className="text-muted-foreground">Jami buyurtmalar:</span>
          <span className="font-mono font-semibold text-foreground">{stats.totalCount} dona</span>
        </div>
        <div className="flex items-center justify-between border border-border bg-card px-2.5 py-1.5 rounded">
          <span className="text-muted-foreground">Kutilmoqda / Yo&apos;lda:</span>
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{stats.inTransitCount} dona</span>
        </div>
        <div className="flex items-center justify-between border border-border bg-card px-2.5 py-1.5 rounded">
          <span className="text-muted-foreground">Bugun muddati:</span>
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{stats.dueTodayCount} dona</span>
        </div>
        <div className="flex items-center justify-between border border-border bg-card px-2.5 py-1.5 rounded">
          <span className="text-muted-foreground">Tayyor / Qabul qilindi:</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{stats.readyCount} dona</span>
        </div>
        <div className="flex items-center justify-between border border-border bg-card px-2.5 py-1.5 rounded">
          <span className="text-muted-foreground">Jami qiymat:</span>
          <span className="font-mono font-semibold text-foreground">
            {stats.totalSum.toLocaleString("uz-UZ")} UZS
          </span>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="border-b border-border bg-card px-3 py-1.5 flex flex-wrap items-center gap-2 justify-between shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={
                viewMode === "orders"
                  ? "PO raqam, WO №, jihoz yoki ta'minotchi..."
                  : "WO №, mijoz, mahsulot yoki jihoz..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 pr-3 text-xs w-full bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedType} onValueChange={(val) => setSelectedType(val || "all")}>
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue placeholder="Jihoz toifasi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha toifalar</SelectItem>
              <SelectItem value="ctp_plates">CTP Metall Forma</SelectItem>
              <SelectItem value="die_tooling">Kesish Shtansformasi</SelectItem>
              <SelectItem value="cliche">Folga & Klishe</SelectItem>
              <SelectItem value="outsourcing">Autsorsing</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "orders" && (
            <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || "all")}>
              <SelectTrigger className="h-7 w-[150px] text-xs">
                <SelectValue placeholder="Holati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha holatlar</SelectItem>
                <SelectItem value="Draft">Qoralama</SelectItem>
                <SelectItem value="Ordered">Buyurtma berildi</SelectItem>
                <SelectItem value="In_Production">Ishlab chiqarilmoqda</SelectItem>
                <SelectItem value="Ready">Tayyor</SelectItem>
                <SelectItem value="Delivered">Yetkazildi</SelectItem>
                <SelectItem value="Cancelled">Bekor qilindi</SelectItem>
              </SelectContent>
            </Select>
          )}

          {(selectedType !== "all" || (viewMode === "orders" && selectedStatus !== "all") || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setSelectedType("all");
                setSelectedStatus("all");
                setSearchQuery("");
              }}
            >
              Filtrni tozalash
            </Button>
          )}
        </div>
      </div>

      {/* 4. Main Data Area (100% Glide Data Grid for Both Modes) */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === "orders" ? (
          <ContextMenu>
            <ContextMenuTrigger className="w-full h-full block">
              <DataEditor
                width="100%"
                height="100%"
                rows={filteredOrders.length}
                columns={columns}
                getCellContent={getCellContent}
                gridSelection={gridSelection}
                onGridSelectionChange={setGridSelection}
                onItemHovered={onItemHovered}
                onCellContextMenu={(cell) => {
                  const [, row] = cell;
                  if (row >= 0 && row < filteredOrders.length) {
                    setGridSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                      current: {
                        cell,
                        range: { x: cell[0], y: row, width: 1, height: 1 },
                        rangeStack: [],
                      },
                    });
                  }
                }}
                rowMarkers="both"
                rowHeight={32}
                headerHeight={30}
                freezeColumns={2}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                onCellActivated={([col, row]) => {
                  const colDef = columns[col];
                  const order = filteredOrders[row];
                  if (!order) return;
                  if (colDef?.id === "image") {
                    const img = getWorkOrderImage(order.workOrderNo, order.imageUrl);
                    if (img) {
                      setPreviewImage(img);
                      return;
                    }
                  }
                  handleOpenEditModal(order);
                }}
              />
            </ContextMenuTrigger>

            <ContextMenuContent className="w-56 text-xs">
              <ContextMenuItem
                onClick={() => selectedOrder && handleOpenEditModal(selectedOrder)}
                disabled={!selectedOrder}
              >
                <FileText className="size-3.5 mr-2" />
                <span>Buyurtmani ko&apos;rish (F12)</span>
              </ContextMenuItem>

              {selectedOrder?.workOrderNo && (
                <ContextMenuItem onClick={() => handleOpenWorkOrder(selectedOrder.workOrderNo)}>
                  <ExternalLink className="size-3.5 mr-2" />
                  <span>Ish buyurtmasini ochish ({selectedOrder.workOrderNo})</span>
                </ContextMenuItem>
              )}

              {selectedOrder?.supplierId && (
                <ContextMenuItem onClick={() => handleOpenSupplier(selectedOrder.supplierId)}>
                  <Building2 className="size-3.5 mr-2" />
                  <span>Ta&apos;minotchi kartochkasini ochish</span>
                </ContextMenuItem>
              )}

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => selectedOrder && handleSendToTelegram(selectedOrder)}
                disabled={!selectedOrder}
                className="gap-2 text-blue-600 dark:text-blue-400 font-medium"
              >
                <Send className="size-3.5 mr-2 text-blue-500" />
                <span>Telegram guruhga yuborish (PO)</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => selectedOrder && handleUpdateStatus(selectedOrder, "In_Production")}
                disabled={!selectedOrder || selectedOrder.status === "In_Production"}
              >
                <Clock className="size-3.5 mr-2 text-blue-500" />
                <span>Ishlab chiqarilmoqda deb belgilash</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => selectedOrder && handleUpdateStatus(selectedOrder, "Ready")}
                disabled={!selectedOrder || selectedOrder.status === "Ready"}
              >
                <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" />
                <span>Tayyor deb belgilash</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => selectedOrder && handleUpdateStatus(selectedOrder, "Delivered")}
                disabled={!selectedOrder || selectedOrder.status === "Delivered"}
              >
                <Truck className="size-3.5 mr-2 text-emerald-600" />
                <span>Yetkazildi deb qabul qilish</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => selectedOrder && handleUpdateStatus(selectedOrder, "Cancelled")}
                disabled={!selectedOrder || selectedOrder.status === "Cancelled"}
                className="text-destructive focus:text-destructive"
              >
                <AlertTriangle className="size-3.5 mr-2" />
                <span>Bekor qilish (Cancelled)</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          /* Deficits View: Glide Data Grid */
          <ContextMenu>
            <ContextMenuTrigger className="w-full h-full block">
              <DataEditor
                width="100%"
                height="100%"
                rows={filteredDeficitRows.length}
                columns={deficitColumns}
                getCellContent={getDeficitCellContent}
                gridSelection={deficitGridSelection}
                onGridSelectionChange={setDeficitGridSelection}
                onItemHovered={onDeficitItemHovered}
                onCellContextMenu={(cell) => {
                  const [, row] = cell;
                  if (row >= 0 && row < filteredDeficitRows.length) {
                    setDeficitGridSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                      current: {
                        cell,
                        range: { x: cell[0], y: row, width: 1, height: 1 },
                        rangeStack: [],
                      },
                    });
                  }
                }}
                rowMarkers="both"
                rowHeight={32}
                headerHeight={30}
                freezeColumns={1}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                onCellActivated={([col, row]) => {
                  const colDef = deficitColumns[col];
                  const def = filteredDeficitRows[row];
                  if (!def) return;
                  if (colDef?.id === "image") {
                    const img = def.imageUrl || getWorkOrderImage(def.workOrderId);
                    if (img) {
                      setPreviewImage(img);
                      return;
                    }
                  }
                  handleOpenCreateModal({
                    workOrderNo: def.workOrderId,
                    title: def.neededTooling,
                    orderType: def.toolingCategory,
                    quantity: def.quantity,
                    unit: def.unit,
                    amount: def.estimatedCost || 0,
                    currency: def.currency || "UZS",
                    specDetails: def.specDetails || "",
                    deliveryDeadline: def.deadline || new Date().toISOString().split("T")[0],
                    fileUrl: def.fileUrl,
                    fileName: def.fileName,
                    imageUrl: def.imageUrl,
                  });
                }}
              />
            </ContextMenuTrigger>

            <ContextMenuContent className="w-56 text-xs">
              <ContextMenuItem
                onClick={() => {
                  if (selectedDeficit) {
                    handleOpenCreateModal({
                      workOrderNo: selectedDeficit.workOrderId,
                      title: selectedDeficit.neededTooling,
                      orderType: selectedDeficit.toolingCategory,
                      quantity: selectedDeficit.quantity,
                      unit: selectedDeficit.unit,
                      amount: selectedDeficit.estimatedCost || 0,
                      currency: selectedDeficit.currency || "UZS",
                      specDetails: selectedDeficit.specDetails || "",
                      deliveryDeadline: selectedDeficit.deadline || new Date().toISOString().split("T")[0],
                      fileUrl: selectedDeficit.fileUrl,
                      fileName: selectedDeficit.fileName,
                      imageUrl: selectedDeficit.imageUrl,
                    });
                  }
                }}
                disabled={!selectedDeficit}
              >
                <Plus className="size-3.5 mr-2 text-primary" />
                <span>Ta&apos;minotchiga buyurtma berish (F12)</span>
              </ContextMenuItem>

              {selectedDeficit?.workOrderId && (
                <ContextMenuItem onClick={() => handleOpenWorkOrder(selectedDeficit.workOrderId)}>
                  <ExternalLink className="size-3.5 mr-2" />
                  <span>Ish buyurtmasini ochish ({selectedDeficit.workOrderId})</span>
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        )}

        {/* Floating Magnified Artwork / Photo Preview (High-Density) */}
        {hoveredPreview && (
          <div
            style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
            className="fixed z-50 pointer-events-none rounded-md bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[340px] max-h-[360px] flex flex-col gap-1.5 overflow-hidden"
          >
            <img
              src={hoveredPreview.url}
              alt="Ish buyurtmasi eskizi"
              className="max-w-[320px] max-h-[280px] w-auto h-auto object-contain rounded border border-border/40 bg-background select-none"
            />
            {hoveredPreview.title && (
              <div className="text-[11px] font-semibold text-foreground truncate max-w-[320px]">
                {hoveredPreview.title}
              </div>
            )}
            {hoveredPreview.subtitle && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[320px]">
                {hoveredPreview.subtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Create / Edit Tooling Order Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setFileError(false);
        }}
      >
        <DialogContent className="sm:max-w-[520px] w-full p-4 gap-2.5 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
          <DialogHeader className="p-0 shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-xs font-semibold flex items-center gap-2">
                <Stamp className="size-3.5 text-primary" />
                <span>{editingOrder ? "Buyurtmani tahrirlash" : "Jihoz / CTP buyurtmasi"}</span>
                {formData.workOrderNo && (
                  <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                    {formData.workOrderNo}
                  </span>
                )}
              </DialogTitle>
            </div>

            {/* Quick Status Pill Actions when editing order */}
            {editingOrder && (
              <div className="flex items-center gap-1.5 pt-1.5">
                {(["Ordered", "In_Production", "Ready", "Delivered"] as const).map((st) => (
                  <Button
                    key={st}
                    type="button"
                    size="sm"
                    variant={formData.status === st ? "default" : "outline"}
                    className={cn(
                      "h-6 px-2 text-[10px] font-medium transition-all",
                      formData.status === st && st === "Ready" && "bg-emerald-600 hover:bg-emerald-700 text-white",
                      formData.status === st && st === "In_Production" && "bg-blue-600 hover:bg-blue-700 text-white",
                      formData.status === st && st === "Delivered" && "bg-purple-600 hover:bg-purple-700 text-white"
                    )}
                    onClick={() => setFormData({ ...formData, status: st })}
                  >
                    {ORDER_STATUS_LABELS[st] || st}
                  </Button>
                ))}
              </div>
            )}
          </DialogHeader>

          <div className="space-y-2 text-xs w-full min-w-0 flex-1 overflow-y-auto pr-1">
            {/* Deficit Switcher when creating new order and multiple deficits exist */}
            {!editingOrder && deficitRows.length > 1 && (
              <div className="space-y-0.5 w-full min-w-0">
                <Select
                  value={
                    deficitRows.find(
                      (d) => d.workOrderId === formData.workOrderNo && d.neededTooling === formData.title
                    )?.id || ""
                  }
                  onValueChange={(val) => {
                    const def = deficitRows.find((d) => d.id === val);
                    if (def) {
                      setFormData((prev) => ({
                        ...prev,
                        workOrderNo: def.workOrderId,
                        title: def.neededTooling,
                        orderType: def.toolingCategory,
                        quantity: def.quantity,
                        unit: def.unit,
                        amount: def.estimatedCost || prev.amount || 0,
                        currency: def.currency || prev.currency || "UZS",
                        specDetails: def.specDetails || "",
                        deliveryDeadline: def.deadline || prev.deliveryDeadline,
                        fileUrl: def.fileUrl,
                        fileName: def.fileName,
                        imageUrl: def.imageUrl,
                      }));
                      setFileError(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-6 text-[11px] bg-muted/40 w-full min-w-0 overflow-hidden">
                    <SelectValue placeholder="Ehtiyojni tanlang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deficitRows.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs max-w-[460px]">
                        <span className="font-mono font-bold mr-1 shrink-0">{d.workOrderId}</span>
                        <span className="text-muted-foreground mr-1 shrink-0">—</span>
                        <span className="truncate flex-1 min-w-0">{d.neededTooling}</span>
                        <span className="font-mono text-muted-foreground ml-1 shrink-0">({d.quantity} {d.unit})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Work Order Details & Attached File (Super Compact High-Density Card) */}
            {formData.workOrderNo ? (
              <div className="rounded border border-border/80 bg-muted/30 p-2 space-y-1.5 w-full min-w-0 overflow-hidden">
                {/* Line 1: Type badge, Title, Quantity */}
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal shrink-0">
                      {formData.title.toLowerCase().includes("flexo") || formData.specDetails?.toLowerCase().includes("digital plate")
                        ? "Flexo Polimer Forma"
                        : ORDER_TYPE_LABELS[formData.orderType] || formData.orderType}
                    </Badge>
                    <span className="font-medium text-foreground truncate min-w-0 flex-1">{formData.title}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground shrink-0 text-xs whitespace-nowrap">
                    {formData.quantity} {formData.unit}
                  </span>
                </div>

                {/* Line 2: Specs & Attached File Pill */}
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-border/40 w-full min-w-0">
                  <span className="text-[10px] text-muted-foreground truncate min-w-0 flex-1">
                    {formData.specDetails || "Format: Standart"}
                  </span>

                  {/* Attached File Action / Pill */}
                  <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                    {(() => {
                      const effImg = formData.imageUrl || getWorkOrderImage(formData.workOrderNo);
                      return effImg ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(effImg)}
                          className="size-5 rounded border border-border overflow-hidden bg-background shrink-0 cursor-pointer hover:ring-1 hover:ring-primary"
                          title="Ish buyurtmasi rasmini ko'rish"
                        >
                          <img src={effImg} alt="Foto" className="size-full object-cover" />
                        </button>
                      ) : null;
                    })()}

                    {formData.fileName ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(formData.fileUrl, formData.fileName)}
                          className="h-5 px-1.5 flex items-center gap-1 rounded bg-background border border-border hover:bg-muted text-[10px] font-mono text-primary cursor-pointer hover:border-primary/50 transition-colors shrink-0"
                          title={`${formData.fileName} faylini yuklab olish`}
                        >
                          <FileText className="size-3 text-primary shrink-0" />
                          <span className="max-w-[120px] truncate">{formData.fileName}</span>
                          <Download className="size-2.5 text-muted-foreground shrink-0" />
                        </button>
                        <label
                          className="size-5 flex items-center justify-center rounded border border-border bg-background hover:bg-muted text-muted-foreground cursor-pointer shrink-0"
                          title="Faylni almashtirish"
                        >
                          <Upload className="size-2.5" />
                          <input
                            type="file"
                            accept=".dxf,.dwg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.svg"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          "h-5 px-1.5 flex items-center gap-1 rounded border border-dashed text-[10px] cursor-pointer shrink-0 whitespace-nowrap transition-colors",
                          fileError
                            ? "border-destructive text-destructive bg-destructive/10 ring-1 ring-destructive/40 font-medium"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <Upload className="size-2.5" />
                        <span>Chizma (CAD/PDF)</span>
                        <input
                          type="file"
                          accept=".dxf,.dwg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.svg"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {fileError && !formData.fileName && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive font-medium pt-1 border-t border-destructive/20">
                    <AlertTriangle className="size-3 shrink-0" />
                    <span>Buyurtma berish uchun jihoz chizma fayli (PDF/DXF/AI) biriktirilishi shart</span>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback for manual free order without a work order */
              <div
                className={cn(
                  "rounded border p-2 space-y-1.5 w-full min-w-0 transition-colors",
                  fileError && !formData.fileName
                    ? "border-destructive/60 bg-destructive/5"
                    : "border-border/80 bg-muted/20"
                )}
              >
                <div className="grid grid-cols-2 gap-1.5 w-full min-w-0">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[10px] font-medium text-muted-foreground">Ish buyurtmasi №</label>
                    <Input
                      value={formData.workOrderNo}
                      onChange={(e) => setFormData({ ...formData, workOrderNo: e.target.value })}
                      placeholder="WO-..."
                      className="h-6 text-xs font-mono w-full min-w-0"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[10px] font-medium text-muted-foreground">Jihoz toifasi</label>
                    <Select
                      value={formData.orderType}
                      onValueChange={(val: any) => setFormData({ ...formData, orderType: val || "ctp_plates" })}
                    >
                      <SelectTrigger className="h-6 text-xs w-full min-w-0">
                        <SelectValue placeholder="Toifa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ctp_plates">CTP Metall Forma</SelectItem>
                        <SelectItem value="die_tooling">Kesish Shtansformasi</SelectItem>
                        <SelectItem value="cliche">Folga / Klishe</SelectItem>
                        <SelectItem value="outsourcing">Autsorsing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <label className="text-[10px] font-medium text-muted-foreground">Jihoz nomi</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="h-6 text-xs w-full min-w-0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 w-full min-w-0">
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[10px] font-medium text-muted-foreground">Miqdori</label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 1 })}
                      className="h-6 text-xs font-mono w-full min-w-0"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <label className="text-[10px] font-medium text-muted-foreground">Birlik</label>
                    <Input
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="h-6 text-xs w-full min-w-0"
                    />
                  </div>
                </div>

                {/* File Attachment for Manual Orders */}
                <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[10px]",
                      fileError && !formData.fileName ? "text-destructive font-medium" : "text-muted-foreground"
                    )}
                  >
                    Jihoz chizma fayli (PDF/DXF):
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {formData.fileName ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(formData.fileUrl, formData.fileName)}
                          className="h-5 px-1.5 flex items-center gap-1 rounded bg-background border border-border hover:bg-muted text-[10px] font-mono text-primary cursor-pointer hover:border-primary/50 transition-colors shrink-0"
                          title={`${formData.fileName} faylini yuklab olish`}
                        >
                          <FileText className="size-3 text-primary shrink-0" />
                          <span className="max-w-[120px] truncate">{formData.fileName}</span>
                          <Download className="size-2.5 text-muted-foreground shrink-0" />
                        </button>
                        <label
                          className="size-5 flex items-center justify-center rounded border border-border bg-background hover:bg-muted text-muted-foreground cursor-pointer shrink-0"
                          title="Faylni almashtirish"
                        >
                          <Upload className="size-2.5" />
                          <input
                            type="file"
                            accept=".dxf,.dwg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.svg"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          "h-5 px-1.5 flex items-center gap-1 rounded border border-dashed text-[10px] cursor-pointer shrink-0 whitespace-nowrap transition-colors",
                          fileError
                            ? "border-destructive text-destructive bg-destructive/10 ring-1 ring-destructive/40 font-medium"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <Upload className="size-2.5" />
                        <span>Chizma yuklash</span>
                        <input
                          type="file"
                          accept=".dxf,.dwg,.pdf,.ai,.eps,.png,.jpg,.jpeg,.svg"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
                {fileError && !formData.fileName && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive font-medium pt-0.5">
                    <AlertTriangle className="size-3 shrink-0" />
                    <span>Buyurtma berish uchun jihoz chizma fayli (PDF/DXF/AI) biriktirilishi shart</span>
                  </div>
                )}
              </div>
            )}

            {/* Active Form Fields */}
            <div className="space-y-2 pt-0.5 w-full min-w-0">
              {/* Supplier Select */}
              <div className="space-y-0.5 w-full min-w-0">
                <label className="text-[11px] font-medium text-foreground">
                  Yetkazib beruvchi kontragent <span className="text-destructive">*</span>
                </label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(val) => setFormData({ ...formData, supplierId: val || "" })}
                >
                  <SelectTrigger className="h-7 text-xs w-full min-w-0 overflow-hidden">
                    <SelectValue placeholder="Ta'minotchini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-[1fr_95px] gap-2 w-full min-w-0">
                <div className="space-y-0.5 min-w-0">
                  <label className="text-[11px] font-medium text-foreground">Kelishilgan narx</label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono w-full min-w-0"
                  />
                </div>

                <div className="space-y-0.5 min-w-0 w-[95px]">
                  <label className="text-[11px] font-medium text-foreground">Valyuta</label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) => setFormData({ ...formData, currency: val || "UZS" })}
                  >
                    <SelectTrigger className="h-7 text-xs w-full min-w-0">
                      <SelectValue placeholder="Valyuta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS" className="text-xs">UZS</SelectItem>
                      <SelectItem value="USD" className="text-xs">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delivery Deadline & Status */}
              <div className="grid grid-cols-[1fr_1fr] gap-2 w-full min-w-0">
                <div className="space-y-0.5 min-w-0">
                  <label className="text-[11px] font-medium text-foreground">Yetkazish sanasi</label>
                  <Input
                    type="date"
                    value={formData.deliveryDeadline}
                    onChange={(e) => setFormData({ ...formData, deliveryDeadline: e.target.value })}
                    className="h-7 text-xs font-mono w-full min-w-0"
                  />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <label className="text-[11px] font-medium text-foreground">Holati</label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val || "Ordered" })}
                  >
                    <SelectTrigger className="h-7 text-xs w-full min-w-0 overflow-hidden">
                      <SelectValue placeholder="Holat">
                        {(val) => ORDER_STATUS_LABELS[val] || val || "Holat"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft" className="text-xs">Qoralama</SelectItem>
                      <SelectItem value="Ordered" className="text-xs">Buyurtma berildi</SelectItem>
                      <SelectItem value="In_Production" className="text-xs">Ishlab chiqarilmoqda</SelectItem>
                      <SelectItem value="Ready" className="text-xs">Tayyor</SelectItem>
                      <SelectItem value="Delivered" className="text-xs">Yetkazildi</SelectItem>
                      <SelectItem value="Cancelled" className="text-xs">Bekor qilindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-0.5 w-full min-w-0">
                <label className="text-[11px] font-medium text-muted-foreground">Izoh</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ta'minotchi uchun eslatma..."
                  className="h-7 text-xs w-full min-w-0"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/40 w-full min-w-0">
            {editingOrder ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 gap-1.5 cursor-pointer"
                onClick={() => {
                  if (editingOrder) {
                    handleSendToTelegram({
                      ...editingOrder,
                      fileUrl: formData.fileUrl || editingOrder.fileUrl,
                      fileName: formData.fileName || editingOrder.fileName,
                    });
                  }
                }}
              >
                <Send className="size-3.5" />
                <span>Telegramga jo&apos;natish</span>
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-3.5"
                onClick={() => setIsModalOpen(false)}
              >
                Bekor qilish
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs px-4 bg-primary text-primary-foreground font-medium"
                onClick={handleSaveOrder}
              >
                Saqlash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal for Attachment Photo */}
      {previewImage && (
        <Dialog open={Boolean(previewImage)} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-md p-2">
            <img src={previewImage} alt="Preview" className="w-full max-h-[75vh] object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
