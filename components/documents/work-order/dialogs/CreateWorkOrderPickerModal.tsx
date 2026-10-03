"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Factory,
  ShoppingCart,
  Wrench,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  MousePointerClick,
  Info,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { MACHINE_MAP } from "../types";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridColumnIcon,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

export interface PendingCrmOrder {
  id: string;
  customer: string;
  product: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  quantity: number;
  unit: string;
  recipe: string;
  deadline: string;
  priority: "Normal" | "High" | "Urgent";
  site: string;
  pressMachine: string;
}

export const MOCK_APPROVED_CRM_ORDERS: PendingCrmOrder[] = [
  {
    id: "CO-00042",
    customer: "Nordic Print Co",
    product: "Woven Labels 30x50 Damask",
    department: "Jacquard",
    quantity: 15000,
    unit: "pcs",
    recipe: "JACQ_WOVEN_V1",
    deadline: "2026-10-14",
    priority: "High",
    site: "Building 2",
    pressMachine: "Staubli Jacquard Loom DX",
  },
  {
    id: "CO-00043",
    customer: "Baltic Press LLC",
    product: "Nylon Taffeta Care Label 30mm",
    department: "Flexo",
    quantity: 25000,
    unit: "m",
    recipe: "FLEXO_NYLON_V1",
    deadline: "2026-10-10",
    priority: "Urgent",
    site: "Building 2",
    pressMachine: "Mark Andy Performance P7",
  },
  {
    id: "CO-00044",
    customer: "Apex Packaging",
    product: "Luxury Perfume Folding Boxes 250g",
    department: "Offset",
    quantity: 10000,
    unit: "pcs",
    recipe: "OFFSET_PREM_V2",
    deadline: "2026-10-18",
    priority: "Normal",
    site: "Building 1",
    pressMachine: "Heidelberg Speedmaster XL 106",
  },
  {
    id: "CO-00045",
    customer: "Alpha Media Group",
    product: "A4 Exhibition Product Catalog 96p",
    department: "Offset",
    quantity: 5000,
    unit: "pcs",
    recipe: "OFFSET_STD_V1",
    deadline: "2026-10-12",
    priority: "High",
    site: "Building 1",
    pressMachine: "Komori Lithrone G40",
  },
  {
    id: "CO-00048",
    customer: "Global Apparel Brand",
    product: "Premium Satin Luxury Ribbon 40mm",
    department: "Flexo",
    quantity: 5000,
    unit: "rolls",
    recipe: "FLEXO_SATIN_V2",
    deadline: "2026-10-16",
    priority: "Normal",
    site: "Building 2",
    pressMachine: "Nilpeter FA-Line",
  },
  {
    id: "CO-00049",
    customer: "Vanguard Fashion LLC",
    product: "Hangtags 350g Soft-Touch + Spot UV",
    department: "Post-press",
    quantity: 8000,
    unit: "pcs",
    recipe: "POST_GENERIC_V1",
    deadline: "2026-10-11",
    priority: "Urgent",
    site: "Building 1",
    pressMachine: "Bobst Novacut 106",
  },
  {
    id: "CO-00051",
    customer: "Eurasia Retail Group",
    product: "Thermal Barcode Shipping Rolls",
    department: "Flexo",
    quantity: 12000,
    unit: "rolls",
    recipe: "FLEXO_NYLON_V1",
    deadline: "2026-10-19",
    priority: "Normal",
    site: "Building 2",
    pressMachine: "Mark Andy Performance P7",
  },
  {
    id: "CO-00053",
    customer: "Orion Media House",
    product: "Hardcover Presentation Book 120p",
    department: "Offset",
    quantity: 3000,
    unit: "pcs",
    recipe: "OFFSET_PREM_V2",
    deadline: "2026-10-21",
    priority: "High",
    site: "Building 1",
    pressMachine: "Heidelberg Speedmaster XL 106",
  },
];

interface CreateWorkOrderPickerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkOrderPickerModal({
  isOpen,
  onOpenChange,
}: CreateWorkOrderPickerModalProps) {
  const { openTab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [mode, setMode] = useState<"crm" | "internal">("crm");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCrmOrderId, setSelectedCrmOrderId] = useState<string>("CO-00042");

  // Internal Order Form State
  const [internalForm, setInternalForm] = useState({
    category: "Rework / Defect Replacement" as
      | "Rework / Defect Replacement"
      | "Make-to-Stock / Inventory"
      | "Machine Calibration & Test Run"
      | "Factory Sample / Marketing",
    department: "Offset" as "Offset" | "Flexo" | "Jacquard" | "Post-press",
    product: "Defect reprint - 500 sheets Folding Carton",
    quantity: 500,
    unit: "pcs",
    priority: "High" as "Normal" | "High" | "Urgent",
    machine: "Heidelberg Speedmaster XL 106",
    site: "Building 1",
    reason: "Lamination roller defect on initial run. Emergency reprint.",
  });

  const filteredCrmOrders = useMemo(() => {
    return MOCK_APPROVED_CRM_ORDERS.filter((order) => {
      const q = searchFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.customer.toLowerCase().includes(q) ||
        order.product.toLowerCase().includes(q) ||
        order.department.toLowerCase().includes(q) ||
        order.pressMachine.toLowerCase().includes(q)
      );
    });
  }, [searchFilter]);

  // Glide Data Grid Selection State
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.fromSingleSelection(0),
  });

  // Keep selection in sync when filtered items change
  useEffect(() => {
    if (filteredCrmOrders.length > 0) {
      const existingIdx = filteredCrmOrders.findIndex((o) => o.id === selectedCrmOrderId);
      const targetIdx = existingIdx >= 0 ? existingIdx : 0;
      setGridSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(targetIdx),
      });
      setSelectedCrmOrderId(filteredCrmOrders[targetIdx].id);
    }
  }, [filteredCrmOrders]);

  const selectedCrmOrder = useMemo(() => {
    return (
      filteredCrmOrders.find((o) => o.id === selectedCrmOrderId) ||
      filteredCrmOrders[0] ||
      null
    );
  }, [filteredCrmOrders, selectedCrmOrderId]);

  // Grid Columns definition
  const crmGridColumns = useMemo<GridColumn[]>(() => [
    { id: "id", title: "Order ID", width: 95, icon: GridColumnIcon.HeaderString },
    { id: "customer", title: "Customer Name", width: 165, icon: GridColumnIcon.HeaderString },
    { id: "product", title: "Product Description", width: 230, icon: GridColumnIcon.HeaderString },
    { id: "department", title: "Department", width: 105, icon: GridColumnIcon.HeaderSingleValue },
    { id: "quantity", title: "Quantity", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "pressMachine", title: "Target Press / Machine", width: 190, icon: GridColumnIcon.HeaderLookup },
    { id: "site", title: "Facility Site", width: 105, icon: GridColumnIcon.HeaderString },
    { id: "deadline", title: "Due Date", width: 95, icon: GridColumnIcon.HeaderDate },
    { id: "priority", title: "Priority", width: 90, icon: GridColumnIcon.HeaderSingleValue },
  ], []);

  // Glide Cell Content Provider
  const getCrmCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const ord = filteredCrmOrders[row];
      if (!ord) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      switch (col) {
        case 0:
          return {
            kind: GridCellKind.Text,
            data: ord.id,
            displayData: ord.id,
            allowOverlay: false,
          };
        case 1:
          return {
            kind: GridCellKind.Text,
            data: ord.customer,
            displayData: ord.customer,
            allowOverlay: false,
          };
        case 2:
          return {
            kind: GridCellKind.Text,
            data: ord.product,
            displayData: ord.product,
            allowOverlay: false,
          };
        case 3:
          return {
            kind: GridCellKind.Text,
            data: ord.department,
            displayData: ord.department,
            allowOverlay: false,
          };
        case 4:
          return {
            kind: GridCellKind.Number,
            data: ord.quantity,
            displayData: `${ord.quantity.toLocaleString()} ${ord.unit}`,
            allowOverlay: false,
          };
        case 5:
          return {
            kind: GridCellKind.Text,
            data: ord.pressMachine,
            displayData: ord.pressMachine,
            allowOverlay: false,
          };
        case 6:
          return {
            kind: GridCellKind.Text,
            data: ord.site,
            displayData: ord.site,
            allowOverlay: false,
          };
        case 7:
          return {
            kind: GridCellKind.Text,
            data: ord.deadline,
            displayData: ord.deadline,
            allowOverlay: false,
          };
        case 8:
          return {
            kind: GridCellKind.Text,
            data: ord.priority,
            displayData: ord.priority,
            allowOverlay: false,
          };
        default:
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }
    },
    [filteredCrmOrders]
  );

  // Selection change in Glide Data Grid
  const handleGridSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      setGridSelection(newSelection);
      const rowIdx = newSelection.rows.first();
      if (rowIdx !== undefined && filteredCrmOrders[rowIdx]) {
        setSelectedCrmOrderId(filteredCrmOrders[rowIdx].id);
      }
    },
    [filteredCrmOrders]
  );

  // Action: Create from order object
  const dispatchOrder = useCallback((orderToDispatch: PendingCrmOrder) => {
    const newWoId = `WO-00${Math.floor(300 + Math.random() * 699)}`;
    openTab({
      id: newWoId,
      title: `${newWoId}: ${orderToDispatch.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
        linkedOrderId: orderToDispatch.id,
        orderType: "Production",
        customer: orderToDispatch.customer,
        product: orderToDispatch.product,
        department: orderToDispatch.department,
        site: orderToDispatch.site,
        recipe: orderToDispatch.recipe,
        quantity: orderToDispatch.quantity,
        unit: orderToDispatch.unit,
        status: "Active",
        priority: orderToDispatch.priority,
        pressMachine: orderToDispatch.pressMachine,
        startDate: new Date().toISOString().split("T")[0],
        deadline: orderToDispatch.deadline,
        currency: "USD",
        priceTotal: 6500.0,
      },
    });
    onOpenChange(false);
  }, [openTab, onOpenChange]);

  // Double click / Cell Activated in Grid dispatches immediately
  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const ord = filteredCrmOrders[row];
      if (ord) {
        dispatchOrder(ord);
      }
    },
    [filteredCrmOrders, dispatchOrder]
  );

  // Handle Dispatch from button
  const handleCreateFromCrm = () => {
    if (selectedCrmOrder) {
      dispatchOrder(selectedCrmOrder);
    }
  };

  // Handle Create Internal / Rework Work Order
  const handleCreateInternal = () => {
    const newWoId = `WO-INT-${Math.floor(100 + Math.random() * 899)}`;
    const defaultRecipe =
      internalForm.department === "Flexo"
        ? "FLEXO_NYLON_V1"
        : internalForm.department === "Jacquard"
        ? "JACQ_WOVEN_V1"
        : internalForm.department === "Post-press"
        ? "POST_GENERIC_V1"
        : "OFFSET_STD_V1";

    openTab({
      id: newWoId,
      title: `${newWoId}: ${internalForm.category.split("/")[0].trim()}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
        linkedOrderId: undefined,
        orderType: "Sample",
        customer: `Internal Factory (${internalForm.category})`,
        product: internalForm.product,
        department: internalForm.department,
        site: internalForm.site,
        recipe: defaultRecipe,
        quantity: internalForm.quantity,
        unit: internalForm.unit,
        status: "Active",
        priority: internalForm.priority,
        pressMachine: internalForm.machine,
        startDate: new Date().toISOString().split("T")[0],
        deadline: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        currency: "USD",
        priceTotal: 0.0, // Internal order has zero commercial customer billing
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-[960px] w-[96vw] max-h-[90vh] text-xs p-0 gap-0 overflow-hidden bg-background flex flex-col shadow-2xl border border-border"
      >
        {/* Modal Header */}
        <DialogHeader className="p-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <DialogTitle className="text-sm font-semibold text-foreground">
              New Production Work Order
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Choose whether to schedule an approved customer order from CRM or dispatch an internal factory rework / stock job.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector Choice Cards */}
        <div className="p-3 bg-muted/30 border-b border-border shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("crm")}
              className={cn(
                "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3",
                mode === "crm"
                  ? "bg-background border-blue-600 ring-2 ring-blue-600/20 shadow-xs"
                  : "bg-card border-border hover:bg-background/80"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-md shrink-0 mt-0.5",
                  mode === "crm"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">From Approved CRM Order</span>
                  {mode === "crm" && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  Import approved customer specs, vector files, and deadlines from CRM into shop floor.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("internal")}
              className={cn(
                "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3",
                mode === "internal"
                  ? "bg-background border-amber-600 ring-2 ring-amber-600/20 shadow-xs"
                  : "bg-card border-border hover:bg-background/80"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-md shrink-0 mt-0.5",
                  mode === "internal"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Wrench className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">Internal / Rework / Stock</span>
                  {mode === "internal" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  Factory-only job (defect reprints, machine calibration, or inventory stock).
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {mode === "crm" ? (
            <div className="space-y-3 flex flex-col h-full">
              {/* Filter bar & hint */}
              <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by ID, client, product, press..."
                    className="h-7.5 pl-8 text-xs bg-background"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
                  <span>Double-click row to dispatch immediately</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="font-medium text-foreground">
                    {filteredCrmOrders.length} pending
                  </span>
                </div>
              </div>

              {/* Glide Data Grid Container */}
              <div className="w-full h-[380px] rounded-lg border border-border overflow-hidden bg-card shadow-xs shrink-0">
                <DataEditor
                  columns={crmGridColumns}
                  rows={filteredCrmOrders.length}
                  getCellContent={getCrmCellContent}
                  gridSelection={gridSelection}
                  onGridSelectionChange={handleGridSelectionChange}
                  onCellActivated={handleCellActivated}
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                  rowMarkers="number"
                  rowSelect="single"
                  smoothScrollX
                  smoothScrollY
                  headerHeight={32}
                  rowHeight={32}
                  width="100%"
                  height="100%"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-[11px]">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Internal Factory Notice:</strong> This order bypasses CRM invoicing and sales commissions. Costs will be recorded directly against plant overhead and scrap allowances.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Order Purpose / Reason *</label>
                  <Select
                    value={internalForm.category}
                    onValueChange={(val: any) => val && setInternalForm((p) => ({ ...p, category: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rework / Defect Replacement">Rework / Defect Replacement (Брак / Переделка)</SelectItem>
                      <SelectItem value="Make-to-Stock / Inventory">Make-to-Stock / Inventory (На склад)</SelectItem>
                      <SelectItem value="Machine Calibration & Test Run">Machine Calibration & Test Run (Калибровка / Тест)</SelectItem>
                      <SelectItem value="Factory Sample / Marketing">Factory Sample / Marketing (Образцы / Реклама)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Manufacturing Department *</label>
                  <Select
                    value={internalForm.department}
                    onValueChange={(val: any) => {
                      if (!val) return;
                      const machines = MACHINE_MAP[val] || [];
                      setInternalForm((p) => ({
                        ...p,
                        department: val,
                        machine: machines[0] || p.machine,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Offset">Offset Sheetfed</SelectItem>
                      <SelectItem value="Flexo">Flexo Rotary</SelectItem>
                      <SelectItem value="Jacquard">Jacquard Weaving</SelectItem>
                      <SelectItem value="Post-press">Post-press Finishing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Internal Job Title / Description *</label>
                <Input
                  value={internalForm.product}
                  onChange={(e) => setInternalForm((p) => ({ ...p, product: e.target.value }))}
                  className="h-8 text-xs font-medium"
                  placeholder="e.g. Defect reprint - 500 sheets Folding Carton"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Planned Quantity</label>
                  <Input
                    type="number"
                    value={internalForm.quantity}
                    onChange={(e) => setInternalForm((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))}
                    className="h-8 text-xs font-mono font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Unit</label>
                  <Select
                    value={internalForm.unit}
                    onValueChange={(val: any) => val && setInternalForm((p) => ({ ...p, unit: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">pcs</SelectItem>
                      <SelectItem value="sets">sets</SelectItem>
                      <SelectItem value="rolls">rolls</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Priority</label>
                  <Select
                    value={internalForm.priority}
                    onValueChange={(val: any) => val && setInternalForm((p) => ({ ...p, priority: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Equipment Assignment</label>
                  <Select
                    value={internalForm.machine}
                    onValueChange={(val: any) => val && setInternalForm((p) => ({ ...p, machine: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(MACHINE_MAP[internalForm.department] || []).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Plant Facility</label>
                  <Select
                    value={internalForm.site}
                    onValueChange={(val: any) => val && setInternalForm((p) => ({ ...p, site: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Building 1">Building 1 (HQ Press Plant)</SelectItem>
                      <SelectItem value="Building 2">Building 2 (Packaging Annex)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Crisp, Fixed Footer with proper responsive button layout */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            {mode === "crm" ? (
              selectedCrmOrder ? (
                <div className="flex items-center gap-2 truncate">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">
                    Dispatching <strong className="text-foreground">{selectedCrmOrder.id}</strong> ({selectedCrmOrder.customer} — {selectedCrmOrder.product})
                  </span>
                </div>
              ) : (
                <span>No order selected</span>
              )
            ) : (
              <span className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Zero-billing factory internal order</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              Cancel
            </Button>

            {mode === "crm" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateFromCrm}
                disabled={!selectedCrmOrder}
                className="h-8 px-3.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5 shadow-none cursor-pointer disabled:opacity-50"
              >
                <span>Dispatch to Shop Floor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateInternal}
                className="h-8 px-3.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow-none cursor-pointer"
              >
                <span>Create Internal Work Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
