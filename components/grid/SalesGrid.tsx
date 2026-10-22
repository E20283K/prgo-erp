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
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

interface SalesGridProps {
  type: string; // "client-orders" | "quotations" | "contracts" | "invoices" | "delivery-acts" | "returns" | "products" | "price-lists" | "discounts"
}

export function SalesGrid({ type }: SalesGridProps) {
  const tCommon = useTranslations("Common");
  const { updateGridStats, theme, openTab, deliveryActs, createDeliveryActFromOrder } = useWorkspaceStore();
  const isDark = theme === "dark";

  const { columns, rows } = useMemo(() => {
    const cols: GridColumn[] = [
      { id: "id", title: "Schet-faktura №", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "date", title: "Date", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "orderId", title: "Order Ref", width: 105, icon: GridColumnIcon.HeaderReference },
      { id: "workOrderId", title: "Work Order", width: 105, icon: GridColumnIcon.HeaderReference },
      { id: "customer", title: "Customer Organization", width: 210, icon: GridColumnIcon.HeaderString },
      { id: "product", title: "Delivered Print Goods", width: 230, icon: GridColumnIcon.HeaderTextTemplate },
      { id: "quantity", title: "Delivered Qty", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "totalAmount", title: "Total w/ VAT ($)", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "linkedShipment", title: "Warehouse Ref", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "status", title: "Status", width: 145, icon: GridColumnIcon.HeaderSingleValue },
    ];
    const dataRows = deliveryActs.map((act) => ({
      ...act,
      linkedShipment: act.linkedShipmentId || "Pending Post",
    }));

    return { columns: cols, rows: dataRows };
  }, [deliveryActs]);

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
             ? (val === "Active" || val === "Accepted" || val === "Paid" || val === "Completed" || val === "Signed & Stamped" || val === "Approved for Reprint" ? "#4ade80" : val === "Inactive" || val === "Cancelled" || val === "Rejected" || val === "Overdue" || val === "Disputed" ? "#f87171" : "#facc15")
             : (val === "Active" || val === "Accepted" || val === "Paid" || val === "Completed" || val === "Signed & Stamped" || val === "Approved for Reprint" ? "#15803d" : val === "Inactive" || val === "Cancelled" || val === "Rejected" || val === "Overdue" || val === "Disputed" ? "#b91c1c" : "#a16207"),
           baseFontStyle: "600 12px sans-serif",
         }
       };
    }

    if (typeof val === "number") {
      return {
        kind: GridCellKind.Number,
        data: val,
        displayData: val.toLocaleString(),
        allowOverlay: true,
        contentAlign: "right",
      };
    }

    return {
      kind: GridCellKind.Text,
      data: String(val),
      displayData: String(val),
      allowOverlay: true,
      contentAlign: "left",
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
    const newAct = createDeliveryActFromOrder({
      orderId: "CO-00041",
      workOrderId: "WOOF-26-0351",
      customer: "Alpha Media Group LLC",
      product: "A4 Hardcover Catalog 96p",
      quantity: 5000,
      unit: "pcs",
      priceTotal: 14850,
      currency: "USD",
    });
    openTab({
      id: newAct.id,
      title: "Yangi Dalolatnoma / Faktura (Qoralama)",
      type: "delivery-act",
      module: "finance",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: newAct,
    });
  };

  const handleOpenSelected = () => {
    const indices = selection.rows.toArray();
    if (indices.length > 0) {
      handleOpenRow(indices[0]);
    }
  };

  const handleOpenRow = (rowIndex: number) => {
    const row = filteredRows[rowIndex];
    if (row) {
      openTab({
        id: row.id,
        title: `${row.id}: ${row.customer}`,
        type: "delivery-act",
        module: "finance",
        activeLevel3Tab: "overview",
        documentData: row,
      });
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
              <div className="relative w-56">
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
                <span>{tCommon("export") || "Export"}</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 w-full h-full relative" id="sales-grid-root">
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
