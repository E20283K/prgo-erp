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
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

interface CrmGridProps {
  type: string; // "customers" | "contacts" | "leads" | "requests"
}

export function CrmGrid({ type }: CrmGridProps) {
  const tCommon = useTranslations("Common");
  const { updateGridStats, theme, setCreateOrderOpen, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let mockRows: any[] = [];

    if (type === "customers") {
      cols = [
        { id: "id", title: "Cust ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Company Name", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "industry", title: "Industry", width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "manager", title: "Account Manager", width: 180, icon: GridColumnIcon.HeaderString },
      ];
      mockRows = Array.from({ length: 150 }, (_, i) => ({
        id: `CST-${String(1000 + i).padStart(4, "0")}`,
        name: ["Alpha Media Group", "Nordic Print Co", "Baltic Press LLC", "Apex Packaging"][i % 4] + ` ${i}`,
        industry: ["Publishing", "Retail", "Manufacturing", "Tech"][i % 4],
        status: ["Active", "Inactive", "On Hold"][i % 3],
        manager: ["E. Voronina", "D. Morozov", "A. Smith"][i % 3],
      }));
    } else if (type === "contacts") {
      cols = [
        { id: "id", title: "Contact ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Full Name", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "customer", title: "Company", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "email", title: "Email", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "phone", title: "Phone", width: 150, icon: GridColumnIcon.HeaderString },
        { id: "role", title: "Role", width: 150, icon: GridColumnIcon.HeaderLookup },
      ];
      mockRows = Array.from({ length: 300 }, (_, i) => ({
        id: `CNT-${String(1000 + i).padStart(4, "0")}`,
        name: ["John Doe", "Jane Smith", "Michael Johnson", "Emily Davis"][i % 4] + ` ${i}`,
        customer: ["Alpha Media Group", "Nordic Print Co", "Baltic Press LLC", "Apex Packaging"][i % 4],
        email: `contact${i}@example.com`,
        phone: `+1 (555) ${String(100 + i % 900).padStart(3, "0")}-${String(1000 + i).slice(-4)}`,
        role: ["CEO", "Procurement Manager", "Marketing Dir", "Designer"][i % 4],
      }));
    } else if (type === "leads") {
      cols = [
        { id: "id", title: "Lead ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "company", title: "Company", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "contact", title: "Contact Person", width: 180, icon: GridColumnIcon.HeaderString },
        { id: "source", title: "Source", width: 120, icon: GridColumnIcon.HeaderLookup },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "score", title: "Score", width: 80, icon: GridColumnIcon.HeaderNumber },
      ];
      mockRows = Array.from({ length: 80 }, (_, i) => ({
        id: `LD-${String(1000 + i).padStart(4, "0")}`,
        company: ["Startup Inc", "MegaCorp", "Local Biz", "New Ventures"][i % 4] + ` ${i}`,
        contact: ["Alice W.", "Bob M.", "Charlie D.", "Diana S."][i % 4],
        source: ["Website", "Referral", "Cold Call", "Exhibition"][i % 4],
        status: ["New", "Contacted", "Qualified", "Lost"][i % 4],
        score: Math.floor(Math.random() * 100),
      }));
    } else if (type === "client-orders") {
      cols = [
        { id: "id", title: "Order ID", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Date", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Customer", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "product", title: "Product", width: 250, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "quantity", title: "Qty", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "orderType", title: "Type", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "status", title: "Status", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 50 }, (_, i) => ({
        id: `CO-${String(41 + i).padStart(5, "0")}`,
        date: `2026-10-${String((i % 30) + 1).padStart(2, "0")}`,
        customer: ["Alpha Media Group", "Nordic Print Co", "Baltic Press LLC", "Apex Packaging"][i % 4],
        product: ["Offset Catalogs 100p", "Woven Labels 30x50", "Nylon Taffeta Roll", "Packaging Boxes"][i % 4],
        quantity: [1000, 5000, 200, 10000][i % 4],
        orderType: ["Sample", "Production", "Production", "Production"][i % 4],
        status: ["Calculating", "Pending Approval", "In Production", "Completed"][i % 4],
      }));
    } else {
      // requests
      cols = [
        { id: "id", title: "Req ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Date", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Customer", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "subject", title: "Subject", width: 300, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "priority", title: "Priority", width: 100, icon: GridColumnIcon.HeaderIfThenElse },
      ];
      mockRows = Array.from({ length: 200 }, (_, i) => ({
        id: `REQ-${String(1000 + i).padStart(4, "0")}`,
        date: `2026-09-${String((i % 30) + 1).padStart(2, "0")}`,
        customer: ["Alpha Media Group", "Nordic Print Co", "Baltic Press LLC", "Apex Packaging"][i % 4],
        subject: ["Quote for 10k catalogs", "Issue with delivery", "Paper stock inquiry", "Contract renewal"][i % 4],
        status: ["Open", "In Progress", "Resolved"][i % 3],
        priority: ["Normal", "High", "Urgent"][i % 3],
      }));
    }

    return { columns: cols, rows: mockRows };
  }, [type]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchFilter, statusFilter]);

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

    if (column.id === "status") {
       return {
         kind: GridCellKind.Text,
         data: String(val),
         displayData: String(val),
         allowOverlay: false,
         themeOverride: {
           textDark: isDark 
             ? (val === "Active" || val === "Resolved" || val === "Qualified" ? "#4ade80" : val === "Inactive" || val === "Lost" ? "#f87171" : "#facc15")
             : (val === "Active" || val === "Resolved" || val === "Qualified" ? "#15803d" : val === "Inactive" || val === "Lost" ? "#b91c1c" : "#a16207"),
           baseFontStyle: "600 12px sans-serif",
         }
       };
    }

    if (column.id === "priority") {
        return {
          kind: GridCellKind.Text,
          data: String(val),
          displayData: String(val),
          allowOverlay: false,
          themeOverride: {
            textDark: isDark
              ? val === "Urgent" ? "#f87171" : val === "High" ? "#fb923c" : "#a1a1aa"
              : val === "Urgent" ? "#dc2626" : val === "High" ? "#ea580c" : "#4b5563",
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

  const handleCreateNew = () => {
    if (type === "client-orders") {
      setCreateOrderOpen(true);
    }
  };

  const handleOpenSelected = () => {
    const indices = selection.rows.toArray();
    if (indices.length > 0) {
      handleOpenRow(indices[0]);
    }
  };

  const handleOpenRow = (rowIndex: number) => {
    if (type === "client-orders") {
      const row = filteredRows[rowIndex];
      if (row) {
        openTab({
          id: row.id,
          title: `${row.id}: ${row.product}`,
          type: "client-order",
          module: "crm",
          documentData: {
            docNo: row.id,
            customer: row.customer,
            product: row.product,
            quantity: row.quantity,
            orderType: row.orderType,
            status: row.status,
            recipe: "OFFSET_STD_V1", // Mock default
            deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          }
        });
      }
    }
  };

  return (
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
              <Button onClick={handleOpenSelected} variant="outline" size="sm" className="h-7 px-2.5 text-xs font-medium gap-1 rounded">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>Open</span>
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Status Filters */}
              {availableStatuses.length > 0 && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${statusFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    ALL
                  </button>
                  {availableStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2 py-0.5 rounded transition-colors ${statusFilter === status ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {status}
                    </button>
                  ))}
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
          <div className="flex-1 w-full h-full relative" id="crm-grid-root">
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
              onCellActivated={(cell) => handleOpenRow(cell[1])}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </div>
      </ContextMenuTrigger>
    </ContextMenu>
  );
}
