"use client";

import React, { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item, 
  GridSelection, 
  CompactSelection, 
  EditableGridCell,
  GridColumnIcon,
  Theme,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from "@/components/ui/context-menu";
import { 
  Plus, 
  Download, 
  Printer, 
  Filter, 
  Search, 
  RefreshCw, 
  Copy, 
  Trash2, 
  ExternalLink,
  Layers,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CalendarDays,
  Table as TableIcon,
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { WorkOrderCalendarView } from "./WorkOrderCalendarView";

export const GLIDE_LIGHT_THEME: Partial<Theme> = {
  accentColor: "#2563eb",
  accentFg: "#ffffff",
  accentLight: "rgba(37, 99, 235, 0.12)",
  bgCell: "#ffffff",
  bgCellMedium: "#f8fafc",
  bgHeader: "#f1f5f9",
  bgHeaderHasFocus: "#e2e8f0",
  bgHeaderHovered: "#e2e8f0",
  textDark: "#0f172a",
  textMedium: "#475569",
  textLight: "#64748b",
  textHeader: "#334155",
  textHeaderSelected: "#0f172a",
  bgIconHeader: "#f1f5f9",
  fgIconHeader: "#64748b",
  borderColor: "#e2e8f0",
  horizontalBorderColor: "#f1f5f9",
  headerBottomBorderColor: "#cbd5e1",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
  baseFontStyle: "12px sans-serif",
  headerFontStyle: "bold 11px sans-serif",
};

export const GLIDE_DARK_THEME: Partial<Theme> = {
  accentColor: "#3b82f6",
  accentFg: "#ffffff",
  accentLight: "rgba(59, 130, 246, 0.2)",
  bgCell: "#18181b",
  bgCellMedium: "#121215",
  bgHeader: "#202026",
  bgHeaderHasFocus: "#27272a",
  bgHeaderHovered: "#27272a",
  textDark: "#f4f4f5",
  textMedium: "#a1a1aa",
  textLight: "#71717a",
  textHeader: "#e4e4e7",
  textHeaderSelected: "#ffffff",
  bgIconHeader: "#202026",
  fgIconHeader: "#a1a1aa",
  borderColor: "#27272a",
  horizontalBorderColor: "#27272a",
  headerBottomBorderColor: "#3f3f46",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
  baseFontStyle: "12px sans-serif",
  headerFontStyle: "bold 11px sans-serif",
};

export interface OrderRow {
  id: string;
  preview: string[];
  allPhotos?: string[];
  rawOrder?: any;
  sampleStage: "mass_production" | "sample_pending" | "sample_review" | "sample_revision" | "sample_approved_mass";
  sampleStatusLabel: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  site: "Building 1" | "Building 2";
  customer: string;
  product: string;
  machine: string;
  qty: number;
  unit: string;
  priceTotal: number;
  status: "Draft" | "Active" | "Completed" | "Cancelled";
  priority: "Normal" | "Urgent" | "High";
  startDate: string;
  deadline: string;
  responsible: string;
}

const INITIAL_COLUMNS: GridColumn[] = [
  { id: "id", title: "Doc No.", width: 120, icon: GridColumnIcon.HeaderReference, hasMenu: true },
  { id: "preview", title: "Eskiz", width: 80, icon: GridColumnIcon.HeaderImage, hasMenu: true },
  { id: "sampleStatus", title: "Namuna holati", width: 160, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "site", title: "Hudud", width: 120, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "department", title: "Sex", width: 110, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "customer", title: "Customer Organization", width: 220, icon: GridColumnIcon.HeaderString, hasMenu: true },
  { id: "product", title: "Product / Specification", width: 260, icon: GridColumnIcon.HeaderTextTemplate, hasMenu: true },
  { id: "qty", title: "Quantity", width: 110, icon: GridColumnIcon.HeaderNumber, hasMenu: true },
  { id: "status", title: "1C Status", width: 110, icon: GridColumnIcon.HeaderSingleValue, hasMenu: true },
  { id: "priority", title: "Priority", width: 95, icon: GridColumnIcon.HeaderIfThenElse, hasMenu: true },
  { id: "deadline", title: "Deadline", width: 115, icon: GridColumnIcon.HeaderDate, hasMenu: true },
];

export function DataGrid() {
  const tGrid = useTranslations("DataGrid");
  const tCommon = useTranslations("Common");
  const tWork = useTranslations("Workspace");
  const tTasks = useTranslations("Tasks");
  const { openTab, updateGridStats, theme, setCreateWorkOrderOpen, productionQueue, loadProductionQueue, isProductionQueueLoading } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [columns, setColumns] = useState<GridColumn[]>(INITIAL_COLUMNS);

  useEffect(() => {
    loadProductionQueue();
  }, [loadProductionQueue]);

  const localizedColumns = React.useMemo(() => {
    const colMap: Record<string, string> = {
      id: tGrid("colId"),
      sampleStatus: tGrid("colSampleStatus"),
      customer: tGrid("colCustomer"),
      product: tGrid("colProduct"),
      qty: tGrid("colQty"),
      status: tGrid("colStatus"),
      priority: tGrid("colPriority"),
      deadline: tGrid("colDeadline"),
    };
    return columns.map((col) => ({
      ...col,
      title: col.id && colMap[col.id] ? colMap[col.id] : col.title,
    }));
  }, [columns, tGrid]);

  // Convert real productionQueue from workspaceStore/DB into OrderRow format
  const rows = React.useMemo<OrderRow[]>(() => {
    return (productionQueue || [])
      .filter((wo: any) => !wo.id?.startsWith("draft-") && !wo.id?.startsWith("temp-"))
      .map((wo: any) => {
      // Collect ONLY real photographic proof photos from DB (no mock fallback!)
      const photos: string[] = [];
      if (Array.isArray(wo.photoUrls) && wo.photoUrls.length > 0) {
        wo.photoUrls.forEach((u: any) => {
          if (typeof u === "string" && u.trim().length > 0) {
            photos.push(u.trim());
          }
        });
      } else if (wo.photoUrl && typeof wo.photoUrl === "string" && wo.photoUrl.trim().length > 0) {
        photos.push(wo.photoUrl.trim());
      }

      const isSampleReq =
        wo.orderType === "Sample" ||
        wo.sampleRequired === true ||
        Boolean(wo.sampleData?.isRequired);

      const approvalStatus = wo.sampleData?.approvalStatus || wo.sampleStatus;
      const isProduced = Boolean(wo.sampleData?.isProduced || wo.sampleProduced);

      let sampleStage: OrderRow["sampleStage"] = "mass_production";
      let sampleStatusLabel = "Ishlab chiqarish";

      if (isSampleReq) {
        if (approvalStatus === "approved") {
          sampleStage = "sample_approved_mass";
          sampleStatusLabel = "Tasdiqlangan (Tirajda)";
        } else if (approvalStatus === "revision_requested") {
          sampleStage = "sample_revision";
          sampleStatusLabel = "Qayta ko'rikda";
        } else if (isProduced || approvalStatus === "awaiting_approval") {
          sampleStage = "sample_review";
          sampleStatusLabel = "Namuna ko'rikda";
        } else {
          sampleStage = "sample_pending";
          sampleStatusLabel = "Namuna kutilmoqda";
        }
      }

      return {
        id: wo.id,
        preview: photos,
        allPhotos: photos,
        sampleStage,
        sampleStatusLabel,
        department: (wo.department as any) || "Offset",
        site: wo.site || "Building 1",
        customer: wo.customer,
        product: wo.product,
        machine: wo.pressMachine,
        qty: wo.quantity,
        unit: wo.unit || "pcs",
        priceTotal: wo.priceTotal || 0,
        status: wo.status || "Draft",
        priority: (wo.priority as any) || "Normal",
        startDate: wo.startDate || "",
        deadline: wo.deadline || "",
        responsible: wo.operator || "Prepress Dept",
        rawOrder: wo,
      };
    });
  }, [productionQueue]);
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date(2026, 9, 6));
  const [calendarSubMode, setCalendarSubMode] = useState<"month" | "week" | "day">("month");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortConfig, setSortConfig] = useState<{ colId: string; asc: boolean } | null>(null);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = React.useMemo(() => {
    let result = rows.filter((r) => {
      const matchesSearch = 
        !searchFilter ||
        r.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.customer.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.product.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.sampleStatusLabel.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortConfig) {
      const { colId, asc } = sortConfig;
      result = [...result].sort((a, b) => {
        let valA: any = "";
        let valB: any = "";
        if (colId === "sampleStatus") {
          valA = a.sampleStatusLabel;
          valB = b.sampleStatusLabel;
        } else {
          valA = (a as any)[colId] ?? "";
          valB = (b as any)[colId] ?? "";
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return asc ? valA - valB : valB - valA;
        }
        const cmp = String(valA).localeCompare(String(valB));
        return asc ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, searchFilter, statusFilter, sortConfig]);

  const handleHeaderClicked = useCallback((colIndex: number) => {
    const column = columns[colIndex];
    const colId = column?.id;
    if (!colId) return;
    setSortConfig((prev) => {
      if (prev && prev.colId === colId) {
        return prev.asc ? { colId, asc: false } : null;
      }
      return { colId, asc: true };
    });
  }, [columns]);

  // Lightweight Hover & Dialog order overview state
  const mouseCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const getCursorCardPosition = useCallback((clientX: number, clientY: number) => {
    const cardWidth = 430;
    const cardHeight = 430;
    let x = clientX + 16;
    let y = clientY + 12;

    if (typeof window !== "undefined") {
      if (x + cardWidth > window.innerWidth - 16) {
        x = clientX - cardWidth - 16;
      }
      if (x < 16) x = 16;

      if (y + cardHeight > window.innerHeight - 16) {
        y = clientY - cardHeight - 12;
      }
      if (y < 16) y = 16;
    }

    return { x, y };
  }, []);

  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    x: number;
    y: number;
  } | null>(null);

  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    if (args.kind === "cell") {
      const [col, row] = args.location;
      const column = columns[col];
      if (column?.id === "preview") {
        const rowData = filteredRows[row];
        // Only trigger hover preview if there is at least one real photo
        if (rowData && rowData.preview.length > 0) {
          let clientX = mouseCoordsRef.current.x;
          let clientY = mouseCoordsRef.current.y;
          if (clientX === 0 && clientY === 0 && typeof document !== "undefined") {
            const container = document.getElementById("glide-grid-root");
            const rect = container?.getBoundingClientRect();
            if (rect) {
              clientX = rect.left + ((args as any).localEventX ?? 20);
              clientY = rect.top + ((args as any).localEventY ?? 20);
            }
          }

          const { x, y } = getCursorCardPosition(clientX, clientY);

          setHoveredPreview({
            url: rowData.preview[0],
            x,
            y,
          });
          return;
        }
      }
    }
    setHoveredPreview(null);
  }, [columns, filteredRows, getCursorCardPosition]);

  // Keep Workspace Status Bar in sync with real-time rows, selections, and active cell coordinates
  useEffect(() => {
    const selectedRowsCount = selection.rows.length;
    let coords = "R1:C1";
    if (selection.current?.cell) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, filteredRows.length, coords);
  }, [selection, filteredRows.length, columns, updateGridStats]);

  // Content Getter for Glide Data Grid
  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const rowData = filteredRows[row];
    if (!rowData) {
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }

    const column = columns[col];
    const colId = column?.id;

    switch (colId) {
      case "id":
        return {
          kind: GridCellKind.Text,
          data: rowData.id,
          displayData: rowData.id,
          allowOverlay: true,
          themeOverride: { textDark: isDark ? "#60a5fa" : "#2563eb", baseFontStyle: "600 12px monospace" },
        };
      case "preview":
        return {
          kind: GridCellKind.Image,
          data: rowData.preview.length > 0 ? [rowData.preview[0]] : [],
          displayData: rowData.preview.length > 0 ? [rowData.preview[0]] : [],
          allowOverlay: false,
          rounding: 4,
          contentAlign: "center",
        };

      case "sampleStatus": {
        let colorDark = "#94a3b8";
        let colorLight = "#64748b";

        if (rowData.sampleStage === "sample_approved_mass") {
          colorDark = "#4ade80";
          colorLight = "#16a34a";
        } else if (rowData.sampleStage === "sample_revision") {
          colorDark = "#f87171";
          colorLight = "#dc2626";
        } else if (rowData.sampleStage === "sample_review") {
          colorDark = "#c084fc";
          colorLight = "#7c3aed";
        } else if (rowData.sampleStage === "sample_pending") {
          colorDark = "#fbbf24";
          colorLight = "#d97706";
        }

        return {
          kind: GridCellKind.Text,
          data: rowData.sampleStatusLabel,
          displayData: rowData.sampleStatusLabel,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? colorDark : colorLight,
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      case "department":
        return {
          kind: GridCellKind.Text,
          data: rowData.department,
          displayData: rowData.department,
          allowOverlay: false,
        };
      case "site":
        return {
          kind: GridCellKind.Text,
          data: rowData.site,
          displayData: rowData.site,
          allowOverlay: false,
        };
      case "customer":
        return {
          kind: GridCellKind.Text,
          data: rowData.customer,
          displayData: rowData.customer,
          allowOverlay: true,
        };
      case "product":
        return {
          kind: GridCellKind.Text,
          data: rowData.product,
          displayData: rowData.product,
          allowOverlay: true,
        };
      case "machine":
        return {
          kind: GridCellKind.Text,
          data: rowData.machine,
          displayData: rowData.machine,
          allowOverlay: true,
        };
      case "qty":
        return {
          kind: GridCellKind.Number,
          data: rowData.qty,
          displayData: `${rowData.qty.toLocaleString()} ${rowData.unit}`,
          allowOverlay: true,
          contentAlign: "right",
        };
      case "priceTotal":
        return {
          kind: GridCellKind.Number,
          data: rowData.priceTotal,
          displayData: `$${rowData.priceTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          allowOverlay: true,
          contentAlign: "right",
        };
      case "status":
        return {
          kind: GridCellKind.Text,
          data: rowData.status,
          displayData: rowData.status,
          allowOverlay: true,
          themeOverride: {
            textDark: isDark
              ? rowData.status === "Active"
                ? "#4ade80"
                : rowData.status === "Completed"
                ? "#38bdf8"
                : rowData.status === "Cancelled"
                ? "#f87171"
                : "#facc15"
              : rowData.status === "Active"
                ? "#15803d"
                : rowData.status === "Completed"
                ? "#0369a1"
                : rowData.status === "Cancelled"
                ? "#b91c1c"
                : "#a16207",
            baseFontStyle: "600 12px sans-serif",
          },
        };
      case "priority":
        return {
          kind: GridCellKind.Text,
          data: rowData.priority,
          displayData: rowData.priority,
          allowOverlay: true,
          themeOverride: {
            textDark: isDark
              ? rowData.priority === "Urgent"
                ? "#f87171"
                : rowData.priority === "High"
                ? "#fb923c"
                : "#a1a1aa"
              : rowData.priority === "Urgent"
                ? "#dc2626"
                : rowData.priority === "High"
                ? "#ea580c"
                : "#4b5563",
            baseFontStyle: "600 12px sans-serif",
          },
        };
      case "startDate":
        return {
          kind: GridCellKind.Text,
          data: rowData.startDate,
          displayData: rowData.startDate,
          allowOverlay: true,
        };
      case "deadline":
        return {
          kind: GridCellKind.Text,
          data: rowData.deadline,
          displayData: rowData.deadline,
          allowOverlay: true,
        };
      case "responsible":
        return {
          kind: GridCellKind.Text,
          data: rowData.responsible,
          displayData: rowData.responsible,
          allowOverlay: true,
        };
      default:
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }
  }, [filteredRows, columns]);

  // Double click on row / cell opens document in new Workspace tab
  const handleCellActivated = useCallback((cell: Item) => {
    const [, row] = cell;
    const rowData = filteredRows[row];
    if (rowData) {
      const raw = rowData.rawOrder || {};
      const photos = rowData.allPhotos && rowData.allPhotos.length > 0
        ? rowData.allPhotos
        : (rowData.preview && rowData.preview.length > 0 ? rowData.preview : (raw.photoUrls || []));
      const primaryPhoto = photos[0] || raw.photoUrl || "";

      openTab({
        id: rowData.id,
        title: `${rowData.id}: ${rowData.product}`,
        type: "work-order",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          ...raw,
          docNo: rowData.id,
          customer: rowData.customer,
          product: rowData.product,
          department: rowData.department,
          site: rowData.site,
          quantity: rowData.qty,
          unit: rowData.unit,
          status: rowData.status,
          priority: rowData.priority,
          pressMachine: rowData.machine,
          startDate: rowData.startDate,
          deadline: rowData.deadline,
          priceTotal: rowData.priceTotal,
          currency: raw.currency || "USD",
          responsible: rowData.responsible,
          photoUrl: primaryPhoto,
          photoUrls: photos,
          attachments: raw.attachments || [],
        },
      });
    }
  }, [filteredRows, openTab]);

  // Support cell editing
  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    if (
      newValue.kind !== GridCellKind.Text &&
      newValue.kind !== GridCellKind.Number &&
      newValue.kind !== GridCellKind.Image
    )
      return;
    const [col, row] = cell;
    const column = columns[col];
    const rowData = filteredRows[row];
    if (!rowData || !column) return;

    // Persist cell edit to workspaceStore item
    useWorkspaceStore.getState().upsertProductionQueueItem({
      id: rowData.id,
      [column.id!]: newValue.data,
    });
  }, [columns, filteredRows]);


  // Support column resize
  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === column.id ? { ...col, width: newSize } : col))
    );
  }, []);

  const handleCreateNew = useCallback(() => {
    const draftId = `draft-wo-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    openTab({
      id: draftId,
      title: "Yangi buyruq (Qoralama)",
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "",
        customer: "",
        product: "",
        quantity: 0,
        unit: "pcs",
        department: "Offset",
        site: "",
        pressMachine: "",
        recipe: "",
        status: "Draft",
        priority: "Normal",
        startDate: today,
        deadline: "",
        paperStock: "",
        coating: "",
        lamination: "",
        embellishment: "",
        priceTotal: 0,
        currency: "UZS",
        operations: [],
        shiftEvents: [],
        attachments: [],
        sampleData: {},
      },
    });
  }, [openTab]);

  // 1C Industrial UX: Insert key triggers new document creation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Insert") {
        e.preventDefault();
        handleCreateNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNew]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
          {/* 1C Enterprise Industrial Toolbar */}
          <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
            {/* Left Actions */}
            <div className="flex items-center gap-1.5">
              <Button 
                onClick={handleCreateNew}
                size="sm" 
                className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tGrid("createNew")}</span>
              </Button>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Status Segment Filter Pills */}
              <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                {[
                  { key: "ALL", label: "ALL" },
                  { key: "Active", label: tCommon("statusActive") },
                  { key: "Draft", label: tCommon("statusDraft") },
                  { key: "Completed", label: tCommon("statusCompleted") },
                  { key: "Cancelled", label: tCommon("statusCancelled") },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      statusFilter === key
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* View mode toggle: Table vs Calendar */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/60 ml-1">
                <button
                  title={tTasks("viewGrid")}
                  onClick={() => setViewMode("grid")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TableIcon className="size-3.5" />
                </button>
                <button
                  title={tTasks("viewCalendar")}
                  onClick={() => setViewMode("calendar")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "calendar"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarDays className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Right Search & Export Controls */}
            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={tGrid("quickFilterPlaceholder")}
                  className="pl-7 h-7 text-xs bg-background border-input rounded"
                />
              </div>

              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" title={tGrid("exportCsv")}>
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>{tCommon("export")}</span>
              </Button>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title={tGrid("printRegistry")}>
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* View Container: Table (Glide Grid) or Calendar */}
          {viewMode === "calendar" ? (
            <div className="flex-1 w-full h-full relative overflow-hidden">
              <WorkOrderCalendarView
                orders={filteredRows}
                onCreateNew={handleCreateNew}
                currentDate={calendarDate}
                onDateChange={setCalendarDate}
                calendarMode={calendarSubMode}
                onCalendarModeChange={setCalendarSubMode}
              />
            </div>
          ) : (
            <div 
              className="flex-1 w-full h-full relative" 
              id="glide-grid-root"
              onMouseMove={(e) => {
                mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
                if (hoveredPreview) {
                  const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                  setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
                }
              }}
              onMouseLeave={() => setHoveredPreview(null)}
            >
            <DataEditor
              getCellContent={getContent}
              columns={localizedColumns}
              rows={filteredRows.length}
              rowMarkers="both"
              freezeColumns={2}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={handleCellActivated}
              onHeaderClicked={handleHeaderClicked}
              onItemHovered={onItemHovered}
              onCellEdited={onCellEdited}
              onColumnResize={onColumnResize}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />

            {/* Hover Image Preview (Full format image only) */}
            {hoveredPreview && (
              <div
                style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
                className="fixed z-50 pointer-events-none rounded-lg bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[430px] max-h-[430px] flex items-center justify-center overflow-hidden"
              >
                <img
                  src={hoveredPreview.url}
                  alt="Order proof preview"
                  className="max-w-[415px] max-h-[415px] w-auto h-auto object-contain rounded select-none"
                />
              </div>
            )}
          </div>
        )}
        </div>
      </ContextMenuTrigger>

      {/* Radix Context Menu on Right Click */}
      <ContextMenuContent className="w-56 text-xs">
        <ContextMenuItem onClick={() => handleCellActivated([0, 0])} className="gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
          <span>{tGrid("contextOpen")}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCreateNew} className="gap-2">
          <Plus className="w-3.5 h-3.5 text-emerald-600" />
          <span>{tGrid("createNew")}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span>{tGrid("colStatus")}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40 text-xs">
            <ContextMenuItem onClick={() => setStatusFilter("Active")}>{tCommon("statusActive")}</ContextMenuItem>
            <ContextMenuItem onClick={() => setStatusFilter("Draft")}>{tCommon("statusDraft")}</ContextMenuItem>
            <ContextMenuItem onClick={() => setStatusFilter("Completed")}>{tCommon("statusCompleted")}</ContextMenuItem>
            <ContextMenuItem onClick={() => setStatusFilter("Cancelled")}>{tCommon("statusCancelled")}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2">
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
          <span>{tGrid("contextCopy")}</span>
        </ContextMenuItem>
        <ContextMenuItem className="gap-2">
          <Printer className="w-3.5 h-3.5 text-zinc-500" />
          <span>{tGrid("printRegistry")}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2 text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
          <span>{tGrid("contextDelete")}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
