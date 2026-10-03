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
import { useSalesStore } from "@/store/salesStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

interface SalesGridProps {
  type: string; // "quotations" | "orders" | "invoices" | "returns" | "price-lists" | "products" | "discounts"
}

export function SalesGrid({ type }: SalesGridProps) {
  const tCommon = useTranslations("Common");
  const tSalesHistory = useTranslations("SalesHistory");
  const { updateGridStats, theme, openTab } = useWorkspaceStore();
  const { salesHistory } = useSalesStore();
  const isDark = theme === "dark";

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let mockRows: any[] = [];

    if (type === "orders") {
      cols = [
        { id: "id", title: tSalesHistory("receiptId"), width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: tSalesHistory("date"), width: 140, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: tSalesHistory("client"), width: 210, icon: GridColumnIcon.HeaderString },
        { id: "product", title: tSalesHistory("products"), width: 260, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "quantity", title: tSalesHistory("totalQty"), width: 95, icon: GridColumnIcon.HeaderNumber },
        { id: "paymentMethod", title: tSalesHistory("paymentMethod"), width: 120, icon: GridColumnIcon.HeaderSingleValue },
        { id: "amount", title: `${tSalesHistory("total")} ($)`, width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: tSalesHistory("status"), width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];

      mockRows = salesHistory.map((sale) => {
        const productDisplay = sale.items.length === 1
          ? sale.items[0].name
          : tSalesHistory("multipleProducts", { count: sale.items.length }) || `${sale.items.length} products`;
        
        const totalQty = sale.items.reduce((acc, item) => acc + item.qty, 0);
        const clientDisplay = sale.clientName || tSalesHistory("walkIn");
        const dateDisplay = new Date(sale.timestamp).toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          id: sale.id,
          date: dateDisplay,
          customer: clientDisplay,
          product: productDisplay,
          quantity: totalQty,
          paymentMethod: sale.paymentMethod,
          amount: Number(sale.total.toFixed(2)),
          status: sale.status || (sale.paymentMethod === "Debt" ? "Debt" : sale.paymentMethod === "Quote" ? "Quote" : "Completed"),
          _original: sale,
        };
      });
    } else if (type === "quotations") {
      cols = [
        { id: "id", title: "Quote ID", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Date", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "Prospect/Client", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "subject", title: "Subject", width: 250, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "amount", title: "Est. Amount", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "validity", title: "Valid Until", width: 120, icon: GridColumnIcon.HeaderDate },
      ];
      mockRows = Array.from({ length: 80 }, (_, i) => ({
        id: `QT-${String(501 + i).padStart(4, "0")}`,
        date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
        customer: ["Global Retailers Ltd", "Workwear Supply Co", "Hotel Chains Inc", "Uniforms Direct", "Boutique Threads"][i % 5],
        subject: ["Bulk Polo Shirts Quote", "Winter Jackets Estimate", "Towel Replenishment", "Kitchen Staff Uniforms", "Custom Print T-Shirts"][i % 5],
        amount: [8000, 45000, 5000, 32000, 12000][i % 5],
        status: ["Draft", "Sent", "Accepted", "Rejected", "Expired"][i % 5],
        validity: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
      }));
    } else if (type === "invoices") {
      cols = [
        { id: "id", title: "Invoice ID", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "orderId", title: "Order Ref", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "date", title: "Issue Date", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "customer", title: "B2B Client", width: 220, icon: GridColumnIcon.HeaderString },
        { id: "amount", title: "Total ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "dueDate", title: "Due Date", width: 120, icon: GridColumnIcon.HeaderDate },
      ];
      mockRows = Array.from({ length: 120 }, (_, i) => ({
        id: `INV-${String(2001 + i).padStart(5, "0")}`,
        orderId: `SO-${String(1001 + i).padStart(5, "0")}`,
        date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
        customer: ["Global Retailers Ltd", "Workwear Supply Co", "Hotel Chains Inc", "Uniforms Direct", "Boutique Threads"][i % 5],
        amount: [7500, 42000, 4500, 30000, 3000][i % 5],
        status: ["Unpaid", "Paid", "Overdue", "Cancelled"][i % 4],
        dueDate: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      }));
    } else if (type === "products") {
      cols = [
        { id: "id", title: "SKU", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Product Name", width: 250, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "category", title: "Category", width: 150, icon: GridColumnIcon.HeaderString },
        { id: "price", title: "Base Price ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "stock", title: "Available Qty", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 200 }, (_, i) => ({
        id: `SKU-${String(8001 + i).padStart(5, "0")}`,
        name: ["Premium Cotton Polo (Navy)", "Industrial Work Jacket", "Luxury Hotel Towel Set", "Fleece Blanket (Queen)", "Chef Coat (White)", "Denim Apron", "Medical Scrubs (Blue)"][i % 7],
        category: ["Apparel", "Workwear", "Hospitality", "Home Textile", "Hospitality", "Workwear", "Healthcare"][i % 7],
        price: [15, 35, 15, 25, 20, 18, 22][i % 7],
        stock: [1500, 400, 2500, 800, 600, 300, 1200][i % 7],
        status: ["Active", "Active", "Out of Stock", "Discontinued"][i % 4],
      }));
    } else {
      cols = [
        { id: "id", title: "ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Description", width: 300, icon: GridColumnIcon.HeaderString },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = Array.from({ length: 50 }, (_, i) => ({
        id: `REC-${String(100 + i).padStart(4, "0")}`,
        name: `Record ${i} for ${type}`,
        status: ["Active", "Inactive"][i % 2],
      }));
    }

    return { columns: cols, rows: mockRows };
  }, [type, salesHistory, tSalesHistory]);

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
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter || (type === "orders" && r.paymentMethod === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchFilter, statusFilter, type]);

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
             ? (val === "Active" || val === "Delivered" || val === "Accepted" || val === "Paid" || val === "Completed" ? "#4ade80" : val === "Inactive" || val === "Cancelled" || val === "Rejected" || val === "Overdue" ? "#f87171" : "#facc15")
             : (val === "Active" || val === "Delivered" || val === "Accepted" || val === "Paid" || val === "Completed" ? "#15803d" : val === "Inactive" || val === "Cancelled" || val === "Rejected" || val === "Overdue" ? "#b91c1c" : "#a16207"),
           baseFontStyle: "600 12px sans-serif",
         }
       };
    }

    if (column.id === "paymentMethod") {
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
        themeOverride: {
          textDark: isDark 
            ? (val === "Cash" ? "#34d399" : val === "Debt" ? "#fbbf24" : "#60a5fa")
            : (val === "Cash" ? "#059669" : val === "Debt" ? "#d97706" : "#2563eb"),
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

  // Unique statuses / payment methods for the filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach(r => {
      if (type === "orders") {
        if (r.paymentMethod) statuses.add(r.paymentMethod);
      } else {
        if (r.status) statuses.add(r.status);
      }
    });
    return Array.from(statuses);
  }, [rows, type]);

  const handleCreateNew = () => {
    if (type === "orders") {
      openTab({
        id: "tab-sales-pos",
        title: "Point of Sale",
        type: "registry",
        module: "sales",
      });
    } else {
      const newDocNo = type === "quotations" ? `QT-${String(Math.floor(1000 + Math.random() * 9000))}` : `SO-${String(Math.floor(1000 + Math.random() * 9000))}`;
      openTab({
        id: newDocNo,
        title: `${newDocNo}: New ${type === "quotations" ? "Quotation" : "Order"}`,
        type: "client-order",
        module: "sales",
        isUnsaved: true,
        activeLevel3Tab: "overview",
        documentData: {
          docNo: newDocNo,
          customer: "",
          product: "",
          quantity: 1000,
          unit: "pcs",
          status: "Draft",
          orderType: type === "quotations" ? "Sample" : "Production",
          recipe: "OFFSET_STD_V1",
          department: "Offset",
          site: "Building 1",
          deadline: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          responsible: "Admin",
          linkedWoId: "",
        },
      });
    }
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
      if (type === "orders") {
        const originalSale = row._original || row;
        openTab({
          id: row.id,
          title: `${row.id} - ${row.customer}`,
          type: "sales-record",
          module: "sales",
          documentData: originalSale,
        });
      } else {
        openTab({
          id: row.id,
          title: `${row.id}`,
          type: "client-order",
          module: "sales",
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
                <span>{type === "orders" ? "New POS Sale" : "Create New"}</span>
              </Button>
              <Button onClick={handleOpenSelected} variant="outline" size="sm" className="h-7 px-2.5 text-xs font-medium gap-1 rounded">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>Open</span>
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Status / Payment Filters */}
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
                  placeholder={type === "orders" ? tSalesHistory("searchPlaceholder") : `Search ${type}...`}
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
