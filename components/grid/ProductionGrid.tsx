"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item, 
  GridSelection, 
  CompactSelection, 
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Download, 
  Printer, 
  Search, 
  ExternalLink,
  ChevronDown,
  Check,
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { CreateWorkOrderPickerModal } from "@/components/documents/work-order/dialogs/CreateWorkOrderPickerModal";

interface ProductionGridProps {
  type: string; // "planning" | "history" | "machines" | "bom" | "materials"
}

export function ProductionGrid({ type }: ProductionGridProps) {
  const tCommon = useTranslations("Common");
  const { updateGridStats, theme, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [isWorkOrderPickerOpen, setIsWorkOrderPickerOpen] = useState(false);

  const handleCreateNew = useCallback(() => {
    if (type === "bom") {
      const newId = `SPEC-00${Math.floor(100 + Math.random() * 900)}`;
      openTab({
        id: newId,
        title: `New Spec`,
        type: "product-spec",
        module: "production",
        isUnsaved: true,
        activeLevel3Tab: "overview",
        documentData: {
          code: newId,
          name: "New Master Recipe",
          department: "Offset",
          status: "Draft",
          version: "1.0",
        }
      });
    } else {
      setIsWorkOrderPickerOpen(true);
    }
  }, [type, openTab]);

  // Keyboard shortcut: Ins to Create New
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Insert" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleCreateNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNew]);

  const handleOpen = () => {
    if (selection.rows.length === 0) return;
    const rowIndex = selection.rows.toArray()[0];
    const selectedRow = filteredRows[rowIndex];
    if (!selectedRow) return;

    if (type === "bom") {
      openTab({
        id: selectedRow.id,
        title: selectedRow.id,
        type: "product-spec",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          code: selectedRow.id,
          name: selectedRow.productName,
          department: "Offset", // mock
          status: selectedRow.status,
          version: selectedRow.version,
          baseMaterial: selectedRow.baseMaterial,
        }
      });
    } else if (selectedRow.workOrder) {
      openTab({
        id: selectedRow.workOrder,
        title: `${selectedRow.workOrder}: Production Order`,
        type: "work-order",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          docNo: selectedRow.workOrder,
          customer: "Alpha Media Group",
          product: "A4 Hardcover Catalog 96p",
          department: "Offset",
          site: "Building 1",
          quantity: 5000,
          unit: "pcs",
          status: "Active",
          priority: "High",
          pressMachine: selectedRow.machine || "Heidelberg Speedmaster XL 106",
          startDate: "2026-09-30",
          deadline: "2026-10-06",
          priceTotal: 14850.00,
          currency: "USD",
          responsible: selectedRow.operator || "Alexey Kovalev",
        }
      });
    }
  };

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let mockRows: any[] = [];

    if (type === "planning") {
      cols = [
        { id: "id", title: "Schedule ID", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "orderType", title: "Order Type", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "workOrder", title: "Work Order", width: 130, icon: GridColumnIcon.HeaderString },
        { id: "parentOrder", title: "Parent Order", width: 120, icon: GridColumnIcon.HeaderString },
        { id: "machine", title: "Machine", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "shift", title: "Shift", width: 100, icon: GridColumnIcon.HeaderString },
        { id: "startTime", title: "Start Time", width: 140, icon: GridColumnIcon.HeaderDate },
        { id: "endTime", title: "End Time", width: 140, icon: GridColumnIcon.HeaderDate },
        { id: "status", title: "Status", width: 160, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 80 }, (_, i) => {
        const isSample = i % 5 === 0;
        return {
          id: `SCH-${String(1000 + i).padStart(4, "0")}`,
          orderType: isSample ? "Sample" : "Production",
          workOrder: `WO-${String(350 + (i % 20)).padStart(5, "0")}${isSample ? "-SMP" : ""}`,
          parentOrder: isSample ? `CO-${String(100 + (i % 20)).padStart(5, "0")}` : "—",
          machine: isSample
            ? ["Xerox Iridesse Digital", "Ricoh Pro C9200", "Epson SureColor Proofer"][i % 3]
            : ["Heidelberg XL 106", "Komori Lithrone G40", "Kolbus BF 513", "Autobond Mini 76 UV"][i % 4],
          shift: isSample ? "Express Run" : ["Day Shift", "Night Shift"][i % 2],
          startTime: `2026-10-${String((i % 10) + 1).padStart(2, "0")} 08:00`,
          endTime: `2026-10-${String((i % 10) + 1).padStart(2, "0")} ${isSample ? "10:30" : "20:00"}`,
          status: isSample
            ? ["Printing Sample", "Ready for Client", "Approved"][i % 3]
            : (i % 7 === 1 ? "Awaiting Sample Approval" : ["Scheduled", "Running", "Delayed"][i % 3]),
        };
      });
    } else if (type === "history") {
      cols = [
        { id: "id", title: "Log ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Date", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "workOrder", title: "Work Order", width: 120, icon: GridColumnIcon.HeaderString },
        { id: "action", title: "Action", width: 180, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "operator", title: "Operator", width: 150, icon: GridColumnIcon.HeaderString },
        { id: "duration", title: "Duration (hrs)", width: 120, icon: GridColumnIcon.HeaderNumber },
      ];
      mockRows = Array.from({ length: 150 }, (_, i) => ({
        id: `LOG-${String(5000 + i).padStart(4, "0")}`,
        date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
        workOrder: `WO-${String(300 + (i % 40)).padStart(5, "0")}`,
        action: ["Setup Machine", "Completed Run", "Maintenance", "Quality Check"][i % 4],
        operator: ["K. Anderson", "M. Ivanova", "S. Petrov", "A. Becker"][i % 4],
        duration: [1.5, 8.0, 2.0, 0.5][i % 4],
      }));
    } else if (type === "machines") {
      cols = [
        { id: "id", title: "Machine ID", width: 120, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Name / Model", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "type", title: "Type", width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "efficiency", title: "Efficiency (%)", width: 120, icon: GridColumnIcon.HeaderNumber },
      ];
      mockRows = Array.from({ length: 15 }, (_, i) => ({
        id: `MAC-${String(100 + i).padStart(3, "0")}`,
        name: ["Heidelberg XL 106", "Komori Lithrone G40", "Kolbus BF 513", "Autobond Mini 76 UV", "Tajima 8-Head Embroidery", "HP Indigo 12000", "Bobst Novacut 106"][i % 7],
        type: ["Offset Printing", "Offset Printing", "Bindery", "Coating", "Sewing", "Digital Printing", "Die Cutting"][i % 7],
        status: ["Idle", "Running", "Maintenance", "Offline"][i % 4],
        efficiency: Math.floor(65 + Math.random() * 30),
      }));
    } else if (type === "bom") {
      cols = [
        { id: "id", title: "BOM ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "productName", title: "Product Template", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "version", title: "Version", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "baseMaterial", title: "Base Material", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "componentsCount", title: "Components", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 45 }, (_, i) => ({
        id: `BOM-${String(1000 + i).padStart(4, "0")}`,
        productName: ["Hardcover Catalog 96p", "A5 Booklet 32p", "Offset Magazine", "Folding Carton Box 350g"][i % 4] + ` - Type ${i}`,
        version: `v1.${i % 5}`,
        baseMaterial: ["Galerie Art Silk 150g", "Munken Polar 120g", "Kraft Board 350g"][i % 3],
        componentsCount: Math.floor(2 + Math.random() * 8),
        status: ["Active", "Draft", "Obsolete"][i % 3],
      }));
    } else {
      // materials
      cols = [
        { id: "id", title: "SKU", width: 120, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Material Name", width: 280, icon: GridColumnIcon.HeaderString },
        { id: "category", title: "Category", width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: "stockLevel", title: "Stock Level", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "unit", title: "Unit", width: 80, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Stock Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 250 }, (_, i) => {
        const stock = Math.floor(Math.random() * 5000);
        const reorder = 1000;
        return {
          id: `MAT-${String(10000 + i).padStart(5, "0")}`,
          name: ["Galerie Art Silk 150g", "Toyo Ink Cyan", "Hot Melt Glue PUR", "Foil Gold 220mm", "Stitching Wire 0.6mm"][i % 5] + ` Variation ${i}`,
          category: ["Paper", "Ink", "Consumables", "Foil", "Wire"][i % 5],
          stockLevel: stock,
          unit: ["sheets", "kg", "kg", "rolls", "spools"][i % 5],
          status: stock > reorder ? "In Stock" : (stock > 0 ? "Low Stock" : "Out of Stock"),
        };
      });
    }

    return { columns: cols, rows: mockRows };
  }, [type]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchesOrderType = orderTypeFilter === "ALL" || !r.orderType || r.orderType === orderTypeFilter;
      return matchesSearch && matchesStatus && matchesOrderType;
    });
  }, [rows, searchFilter, statusFilter, orderTypeFilter]);

  // Keep Workspace Status Bar in sync
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

  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const rowData = filteredRows[row];
    if (!rowData) {
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }

    const column = columns[col];
    const val = rowData[column.id as keyof typeof rowData];

    if (column.id === "orderType") {
      const isSample = val === "Sample";
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: isSample ? "🧪 Sample Proof" : "Production Run",
        allowOverlay: false,
        themeOverride: {
          textDark: isDark ? (isSample ? "#fbbf24" : "#60a5fa") : (isSample ? "#b45309" : "#1d4ed8"),
          baseFontStyle: "600 12px sans-serif",
        },
      };
    }

    if (column.id === "status") {
      let colorDark = "#facc15";
      let colorLight = "#a16207";

      if (val === "Running" || val === "Active" || val === "In Stock" || val === "Approved") {
        colorDark = "#4ade80";
        colorLight = "#15803d";
      } else if (val === "Delayed" || val === "Maintenance" || val === "Out of Stock" || val === "Obsolete") {
        colorDark = "#f87171";
        colorLight = "#b91c1c";
      } else if (val === "Awaiting Sample Approval") {
        colorDark = "#fb7185";
        colorLight = "#be123c";
      } else if (val === "Printing Sample" || val === "Ready for Client") {
        colorDark = "#fbbf24";
        colorLight = "#b45309";
      }

      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
        themeOverride: {
          textDark: isDark ? colorDark : colorLight,
          baseFontStyle: "600 12px sans-serif",
        },
      };
    }

    return {
      kind: typeof val === "number" ? GridCellKind.Number : GridCellKind.Text,
      data: val,
      displayData: String(val),
      allowOverlay: true,
      contentAlign: typeof val === "number" ? "right" : "left",
    };
  }, [filteredRows, columns, isDark]);

  // Unique statuses for the filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach(r => {
      if (r.status) statuses.add(r.status);
    });
    return Array.from(statuses);
  }, [rows]);

  // Partition statuses: keep only the most necessary as direct pills, tuck remainder under dropdown
  const { primaryStatuses, overflowStatuses } = useMemo(() => {
    if (availableStatuses.length <= 4) {
      return { primaryStatuses: availableStatuses, overflowStatuses: [] };
    }

    // High frequency primary statuses
    const PRIORITY_ORDER = ["Scheduled", "Running", "Delayed", "Active", "In Stock"];
    const prioritized = availableStatuses.filter((s) => PRIORITY_ORDER.includes(s));

    // Pick top 3 for direct pills
    const topPrimary = (prioritized.length > 0 ? prioritized : availableStatuses).slice(0, 3);
    const overflow = availableStatuses.filter((s) => !topPrimary.includes(s));

    return { primaryStatuses: topPrimary, overflowStatuses: overflow };
  }, [availableStatuses]);

  return (
    <>
      <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
          {/* Toolbar */}
          <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Button onClick={handleCreateNew} size="sm" className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded">
                <Plus className="w-3.5 h-3.5" />
                <span>Create New</span>
              </Button>
              <Button onClick={handleOpen} variant="outline" size="sm" className="h-7 px-2.5 text-xs font-medium gap-1 rounded">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>Open</span>
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Order Type Filter (Planning View) */}
              {type === "planning" && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium mr-1">
                  <button
                    onClick={() => setOrderTypeFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      orderTypeFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    onClick={() => setOrderTypeFilter("Production")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      orderTypeFilter === "Production" ? "bg-background text-blue-600 font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Production
                  </button>
                  <button
                    onClick={() => setOrderTypeFilter("Sample")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      orderTypeFilter === "Sample" ? "bg-amber-500 text-white font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🧪 Samples
                  </button>
                </div>
              )}

              {/* Status Filters (Most necessary as direct pills, remainder under compact dropdown) */}
              {availableStatuses.length > 0 && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      statusFilter === "ALL"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ALL
                  </button>
                  {primaryStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        statusFilter === status
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {status}
                    </button>
                  ))}

                  {/* Overflow Dropdown for other statuses */}
                  {overflowStatuses.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                              overflowStatuses.includes(statusFilter)
                                ? "bg-background text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          />
                        }
                      >
                        <span className="truncate max-w-[130px]">
                          {overflowStatuses.includes(statusFilter) ? statusFilter : `More (${overflowStatuses.length})`}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 text-xs">
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
                          Additional Statuses
                        </DropdownMenuLabel>
                        {overflowStatuses.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                          >
                            <span>{status}</span>
                            {statusFilter === status && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Search ${type}...`}
                  className="pl-7 h-7 text-xs bg-background border-input rounded"
                />
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>{tCommon("export")}</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 w-full h-full relative" id="production-grid-root">
            <DataEditor
              getCellContent={getContent}
              columns={columns}
              rows={filteredRows.length}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellActivated={(cell) => {
                const [col, row] = cell;
                setSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row)
                });
                // Small delay to ensure state update completes
                setTimeout(handleOpen, 50);
              }}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56 text-xs">
        <ContextMenuItem onClick={handleCreateNew} className="gap-2 cursor-pointer">
          <Plus className="w-3.5 h-3.5 text-blue-500" />
          <span>New Production Order</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpen} className="gap-2 cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Open Selected</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    {/* Lightweight Picker for Production Work Orders */}
    <CreateWorkOrderPickerModal
      isOpen={isWorkOrderPickerOpen}
      onOpenChange={setIsWorkOrderPickerOpen}
    />
  </>
  );
}
