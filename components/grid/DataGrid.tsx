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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  Image as ImageIcon
} from "lucide-react";


import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";

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

// Real photographic proof sample (publication / catalog proof) used for all mock rows
const REAL_PROOF_IMAGE = "/sample-proof.jpg";

const INITIAL_COLUMNS: GridColumn[] = [
  { id: "id", title: "Doc No.", width: 120, icon: GridColumnIcon.HeaderReference, hasMenu: true },
  { id: "preview", title: "Proof Sample", width: 95, icon: GridColumnIcon.HeaderImage, hasMenu: true },
  { id: "site", title: "Production Site", width: 140, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "department", title: "Technology", width: 130, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "customer", title: "Customer Organization", width: 220, icon: GridColumnIcon.HeaderString, hasMenu: true },
  { id: "product", title: "Product / Specification", width: 260, icon: GridColumnIcon.HeaderTextTemplate, hasMenu: true },
  { id: "machine", title: "Assigned Workstation", width: 190, icon: GridColumnIcon.HeaderLookup, hasMenu: true },
  { id: "qty", title: "Quantity", width: 100, icon: GridColumnIcon.HeaderNumber, hasMenu: true },
  { id: "priceTotal", title: "Total (USD)", width: 120, icon: GridColumnIcon.HeaderMath, hasMenu: true },
  { id: "status", title: "1C Status", width: 110, icon: GridColumnIcon.HeaderSingleValue, hasMenu: true },
  { id: "priority", title: "Priority", width: 95, icon: GridColumnIcon.HeaderIfThenElse, hasMenu: true },
  { id: "startDate", title: "Start Date", width: 110, icon: GridColumnIcon.HeaderDate, hasMenu: true },
  { id: "deadline", title: "Deadline", width: 110, icon: GridColumnIcon.HeaderDate, hasMenu: true },
  { id: "responsible", title: "Manager / Lead", width: 150, icon: GridColumnIcon.HeaderString, hasMenu: true },
];

const MOCK_CUSTOMERS = [
  "Alpha Media Group", "Nordic Print Co", "Baltic Press LLC", "Apex Packaging", 
  "Global Apparel Brand", "Zenith Publishing", "Vanguard Fashion", "Metropolis Books"
];

const MACHINE_MAP: Record<string, string[]> = {
  Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
  Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
  Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
  "Post-press": ["Kolbus BF 513", "Bobst Novacut 106"]
};

const PRODUCT_MAP: Record<string, string[]> = {
  Offset: ["Hardcover Catalog 96p", "Folding Carton Box 350g", "Glossy Paper Hangtags", "A5 Booklet 32p"],
  Flexo: ["Satin Care Labels", "Nylon Wash Labels", "Self-Adhesive Roll Labels", "Tyvek Labels"],
  Jacquard: ["Premium Woven Neck Labels", "Woven Patches", "Taffeta Side Labels", "Damask Woven Labels"],
  "Post-press": ["Folding", "Die-cutting", "Laminating"]
};

const DEPARTMENTS = ["Offset", "Flexo", "Jacquard", "Post-press"] as const;

export function generateMockOrders(count: number): OrderRow[] {
  const statuses: OrderRow["status"][] = ["Active", "Completed", "Draft", "Cancelled"];
  const priorities: OrderRow["priority"][] = ["Normal", "High", "Urgent"];

  return Array.from({ length: count }, (_, i) => {
    const idNum = 350 + i;
    const docNo = `WO-${String(idNum).padStart(5, "0")}`;
    const qty = [500, 1000, 2500, 5000, 10000, 20000][i % 6];
    const unitPrice = [0.45, 1.20, 2.80, 4.50, 12.00][i % 5];
    const total = qty * unitPrice;

    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    const site = (department === "Offset" || department === "Post-press") ? "Building 1" : "Building 2";
    
    const prodList = PRODUCT_MAP[department];
    const prod = prodList[i % prodList.length];
    
    const machList = MACHINE_MAP[department];
    const mach = machList[i % machList.length];

    return {
      id: docNo,
      preview: [REAL_PROOF_IMAGE],
      department,
      site,
      customer: MOCK_CUSTOMERS[i % MOCK_CUSTOMERS.length],
      product: prod,
      machine: mach,
      qty,
      unit: department === "Jacquard" ? "pcs" : department === "Flexo" ? "rolls" : "sheets",
      priceTotal: total,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      startDate: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      deadline: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      responsible: ["K. Anderson", "M. Ivanova", "S. Petrov", "A. Becker"][i % 4],
    };
  });
}



export function DataGrid() {
  const tGrid = useTranslations("DataGrid");
  const tCommon = useTranslations("Common");
  const tWork = useTranslations("Workspace");
  const { openTab, updateGridStats, theme, setCreateWorkOrderOpen } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [columns, setColumns] = useState<GridColumn[]>(INITIAL_COLUMNS);

  const localizedColumns = React.useMemo(() => {
    const colMap: Record<string, string> = {
      preview: tGrid("colId"),
      type: tGrid("colMachine"),
      customer: tGrid("colCustomer"),
      product: tGrid("colProduct"),
      machine: tGrid("colMachine"),
      qty: tGrid("colQty"),
      priceTotal: tGrid("colPrice"),
      status: tGrid("colStatus"),
      priority: tGrid("colPriority"),
      startDate: tGrid("colStart"),
      deadline: tGrid("colDeadline"),
      responsible: tGrid("colResponsible"),
    };
    return columns.map((col) => ({
      ...col,
      title: col.id && colMap[col.id] ? colMap[col.id] : col.title,
    }));
  }, [columns, tGrid]);

  const [rows, setRows] = useState<OrderRow[]>(() => generateMockOrders(1250));
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch = 
        !searchFilter ||
        r.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.customer.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.product.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchFilter, statusFilter]);

  // Lightweight Hover & Dialog order overview state
  const mouseCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const getCursorCardPosition = useCallback((clientX: number, clientY: number) => {
    const cardWidth = 230;
    const cardHeight = 220;
    let x = clientX + 16;
    let y = clientY + 12;

    if (typeof window !== "undefined") {
      if (x + cardWidth > window.innerWidth - 12) {
        x = clientX - cardWidth - 16;
      }
      if (x < 12) x = 12;

      if (y + cardHeight > window.innerHeight - 12) {
        y = clientY - cardHeight - 12;
      }
      if (y < 12) y = 12;
    }

    return { x, y };
  }, []);

  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    docNo: string;
    product: string;
    customer: string;
    qty: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedPreviewRow, setSelectedPreviewRow] = useState<OrderRow | null>(null);

  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    if (args.kind === "cell") {
      const [col, row] = args.location;
      const column = columns[col];
      if (column?.id === "preview") {
        const rowData = filteredRows[row];
        if (rowData) {
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
            docNo: rowData.id,
            product: rowData.product,
            customer: rowData.customer,
            qty: `${rowData.qty.toLocaleString()} ${rowData.unit}`,
            x,
            y,
          });
          return;
        }
      }
    }
    setHoveredPreview(null);
  }, [columns, filteredRows, getCursorCardPosition]);


  const onCellClicked = useCallback((cell: Item) => {
    const [col, row] = cell;
    const column = columns[col];
    if (column?.id === "preview") {
      const rowData = filteredRows[row];
      if (rowData) {
        setSelectedPreviewRow(rowData);
      }
    }
  }, [columns, filteredRows]);



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
          data: rowData.preview,
          displayData: rowData.preview,
          allowOverlay: true,
          rounding: 4,
          contentAlign: "center",
        };

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
      openTab({
        id: rowData.id,
        title: `${rowData.id}: ${rowData.product}`,
        type: "work-order",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
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
          currency: "USD",
          responsible: rowData.responsible,
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

    setRows((prev) =>
      prev.map((r) => {
        if (r.id === rowData.id) {
          return {
            ...r,
            [column.id!]: newValue.data,
          };
        }
        return r;
      })
    );
  }, [columns, filteredRows]);


  // Support column resize
  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === column.id ? { ...col, width: newSize } : col))
    );
  }, []);

  const handleCreateNew = useCallback(() => {
    setCreateWorkOrderOpen(true);
  }, [setCreateWorkOrderOpen]);

  // 1C Industrial UX: Insert key triggers new document creation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Insert") {
        e.preventDefault();
        setCreateWorkOrderOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCreateWorkOrderOpen]);

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

              <Button 
                onClick={() => {
                  const selectedRowIdx = selection.rows.toArray()[0] ?? 0;
                  if (filteredRows[selectedRowIdx]) {
                    handleCellActivated([0, selectedRowIdx]);
                  }
                }}
                variant="outline" 
                size="sm" 
                className="h-7 px-2.5 text-xs font-medium gap-1 rounded"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>{tGrid("contextOpen")}</span>
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

          {/* Glide Data Grid Container */}
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
              onCellClicked={onCellClicked}
              onItemHovered={onItemHovered}
              onCellEdited={onCellEdited}
              onColumnResize={onColumnResize}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />

            {/* Hover Image Preview Tooltip Card (Minimal Order Overview) */}
            {hoveredPreview && (
              <div
                style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
                className="fixed z-50 pointer-events-none w-56 rounded-lg bg-popover text-popover-foreground border border-border shadow-xl p-2.5 flex flex-col gap-2 animate-in fade-in-0 zoom-in-95 duration-75"
              >
                <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted border border-border/60">
                  <img
                    src={hoveredPreview.url}
                    alt={hoveredPreview.product}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[9px] font-bold backdrop-blur-xs">
                    {hoveredPreview.docNo}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate">
                    {hoveredPreview.product}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {hoveredPreview.customer}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                    <span className="text-muted-foreground font-mono">{hoveredPreview.qty}</span>
                    <span className="font-medium text-primary">Click to inspect</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Order Overview Dialog Card */}
      <Dialog 
        open={!!selectedPreviewRow} 
        onOpenChange={(open) => !open && setSelectedPreviewRow(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                {selectedPreviewRow?.id}
              </DialogTitle>
              <Badge 
                variant="outline" 
                className="text-[10px] font-semibold uppercase tracking-wider h-5 px-2"
              >
                {selectedPreviewRow?.status}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedPreviewRow?.customer}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center">
              {selectedPreviewRow && (
                <img
                  src={selectedPreviewRow.preview[0]}
                  alt={selectedPreviewRow.product}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
              <div>
                <span className="text-[10px] text-muted-foreground block">Product</span>
                <span className="font-medium text-foreground truncate block">{selectedPreviewRow?.product}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Quantity</span>
                <span className="font-medium text-foreground">{selectedPreviewRow?.qty.toLocaleString()} {selectedPreviewRow?.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Machine</span>
                <span className="font-medium text-foreground truncate block">{selectedPreviewRow?.machine}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Deadline</span>
                <span className="font-medium text-foreground">{selectedPreviewRow?.deadline}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPreviewRow(null)}
              className="text-xs h-8"
            >
              {tCommon("close")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (selectedPreviewRow) {
                  handleCellActivated([0, rows.findIndex(r => r.id === selectedPreviewRow.id)]);
                  setSelectedPreviewRow(null);
                }
              }}
              className="text-xs gap-1.5 h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{tGrid("contextOpen")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
