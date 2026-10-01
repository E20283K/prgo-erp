"use client";

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import {
  FileText,
  DollarSign,
  Package,
  History,
  Save,
  Check,
  Printer,
  Factory,
  Beaker,
  Send,
  CheckCircle2,
  Truck,
  ChevronRight,
  Clock,
  RotateCcw,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  EditableGridCell,
  GridColumnIcon,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; price: number }[]> = {
  "OFFSET_STD_V1": [
    { name: "Galerie Art Silk Paper 150g", req: 12500, unit: "Sheets", price: 0.12 },
    { name: "Hubergroup CMYK Ink", req: 36, unit: "kg", price: 15.50 },
    { name: "Agfa CTP Plates", req: 24, unit: "pcs", price: 8.00 },
  ],
  "FLEXO_NYLON_V1": [
    { name: "Nylon Taffeta Tape 30mm", req: 45, unit: "Rolls", price: 12.00 },
    { name: "Wash-Resistant Ink Black", req: 2, unit: "kg", price: 45.00 },
  ],
  "JACQ_WOVEN_V1": [
    { name: "Polyester Warp Yarn Black", req: 120, unit: "kg", price: 4.50 },
    { name: "Polyester Weft Yarn White", req: 85, unit: "kg", price: 4.80 },
  ],
};

const COURIER_OPTIONS = ["Yandex Delivery", "UPS", "FedEx", "DHL", "Own driver", "Client pickup"];

export function ClientOrderDetail({ tab }: { tab: DocumentTab }) {
  const t = useTranslations("ClientOrder");
  const { setTabUnsaved, closeTab, setLevel3Tab, theme, openTab, addNotification, currentUser } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  const activeTab = tab.activeLevel3Tab || "overview";

  // --- State: Overview ---
  const [formData, setFormData] = useState({
    customer: data.customer || "",
    product: data.product || "",
    quantity: data.quantity || 1000,
    unit: data.unit || "pcs",
    recipe: data.recipe || "OFFSET_STD_V1",
    deadline: data.deadline || "",
    responsible: data.responsible || currentUser.name,
    orderType: data.orderType || "Production",
    linkedWoId: data.linkedWoId || "",
    status: data.status || "Calculating",
  });

  // --- State: Cost Calculation ---
  const [calcMode, setCalcMode] = useState<"Auto" | "Manual">("Auto");
  const [materials, setMaterials] = useState(
    RECIPE_MATERIALS[formData.recipe]?.map((m, i) => ({ id: `m-${i}`, ...m })) || []
  );
  
  const [services, setServices] = useState([
    { id: "s-1", name: "Machine Setup Fee", qty: 1, unit: "lump", price: 150 },
    { id: "s-2", name: "Press Run", qty: 8, unit: "hrs", price: 85 },
    { id: "s-3", name: "Pre-press / Plates", qty: 1, unit: "lump", price: 120 },
  ]);

  const [overheadPct, setOverheadPct] = useState(15);
  const [marginPct, setMarginPct] = useState(25);
  const [currency, setCurrency] = useState(data.currency || "USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // --- State: Physical Sample ---
  const [sampleData, setSampleData] = useState({
    dispatchDate: data.sampleDispatchDate || new Date().toISOString().split("T")[0],
    deliveryMethod: data.sampleDeliveryMethod || "Courier service",
    courierName: data.sampleCourier || "",
    recipientName: data.sampleRecipient || "",
    recipientPhone: data.samplePhone || "",
    deliveryAddress: data.sampleAddress || "",
    trackingNumber: data.sampleTracking || "",
    sampleQty: data.sampleQty || 5,
    packingNotes: data.sampleNotes || "",
    isDispatched: data.sampleDispatched || false,
    approvalStatus: data.approvalStatus || "Pending",
    approvalNotes: data.approvalNotes || "",
  });

  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);

  // --- Handlers ---
  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSampleChange = (field: string, val: any) => {
    setSampleData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
  };

  const handleSaveAndClose = () => {
    handleSave();
    closeTab(tab.id);
  };

  const handleMarkDispatched = () => {
    handleSampleChange("isDispatched", true);
    addNotification({
      title: `Sample dispatched for ${tab.id}`,
      description: `Sent via ${sampleData.deliveryMethod} to ${sampleData.recipientName}. Awaiting approval.`,
      severity: "info",
      link: { module: "crm", subModule: "client-orders" }
    });
  };

  const handleCreateWorkOrder = () => {
    const newWoId = `WO-00${Math.floor(Math.random() * 900) + 100}`;
    
    openTab({
      id: newWoId,
      title: `${newWoId}: ${formData.customer} — ${formData.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
        customer: formData.customer,
        product: formData.product,
        quantity: formData.orderType === "Sample" ? sampleData.sampleQty : formData.quantity,
        unit: formData.unit,
        status: "Draft",
        priority: "Normal",
        orderType: formData.orderType,
        linkedOrderId: tab.id,
        recipe: formData.recipe,
        deadline: formData.deadline,
        currency: currency,
      },
    });

    handleFieldChange("linkedWoId", newWoId);
    handleFieldChange("status", "In Production");
    setIsConfirmSendOpen(false);
    
    addNotification({
      title: "Work Order Created",
      description: `${newWoId} has been pushed to Production.`,
      severity: "success",
    });
  };

  const calcColumns = useMemo<GridColumn[]>(() => [
    { id: "name", title: t("materialName") || "Item Name", width: 260, icon: GridColumnIcon.HeaderString },
    { id: "qty", title: t("qty") || "Qty", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: t("unit") || "Unit", width: 85, icon: GridColumnIcon.HeaderLookup },
    { id: "price", title: t("unitPrice") || "Unit Price", width: 110, icon: GridColumnIcon.HeaderMath },
    { id: "total", title: t("total") || "Total", width: 120, icon: GridColumnIcon.HeaderMath },
  ], [t]);

  const getCalcCell = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const isMaterial = row < materials.length;
    const item: any = isMaterial ? materials[row] : services[row - materials.length];
    if (!item) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    const isService = !isMaterial;
    const colId = calcColumns[col].id;

    if (colId === "name") {
      return {
        kind: GridCellKind.Text,
        data: item.name,
        displayData: item.name,
        allowOverlay: false,
        themeOverride: isService ? { 
          textDark: "#60a5fa", 
          textLight: "#2563eb",
          baseFontStyle: "600 12px sans-serif" 
        } : undefined
      };
    } else if (colId === "qty") {
      const qty = item.qty ?? item.req;
      return {
        kind: GridCellKind.Number,
        data: qty,
        displayData: String(qty),
        allowOverlay: true,
        readonly: false,
        contentAlign: "right",
      };
    } else if (colId === "unit") {
      return { 
        kind: GridCellKind.Text, 
        data: item.unit, 
        displayData: item.unit, 
        allowOverlay: false 
      };
    } else if (colId === "price") {
      return {
        kind: GridCellKind.Number,
        data: item.price,
        displayData: Number(item.price).toFixed(2),
        allowOverlay: true,
        readonly: false,
        contentAlign: "right",
      };
    } else if (colId === "total") {
      const qty = item.qty ?? item.req;
      const total = qty * item.price;
      return {
        kind: GridCellKind.Number,
        data: total,
        displayData: total.toFixed(2),
        allowOverlay: false,
        contentAlign: "right",
      };
    }
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [materials, services, calcColumns]);

  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const isMaterial = row < materials.length;
    const colId = calcColumns[col].id;

    if (newValue.kind !== GridCellKind.Number) return;

    if (isMaterial) {
      const newM = [...materials];
      if (colId === "qty") newM[row].req = newValue.data as number;
      if (colId === "price") newM[row].price = newValue.data as number;
      setMaterials(newM);
    } else {
      const sIdx = row - materials.length;
      const newS = [...services];
      if (colId === "qty") newS[sIdx].qty = newValue.data as number;
      if (colId === "price") newS[sIdx].price = newValue.data as number;
      setServices(newS);
    }
  }, [materials, services, calcColumns]);

  // --- Calculations ---
  const materialsTotal = materials.reduce((acc, m) => acc + (m.req * m.price), 0);
  const servicesTotal = services.reduce((acc, s) => acc + (s.qty * s.price), 0);
  const subtotal = materialsTotal + servicesTotal;
  const overheadAmount = subtotal * (overheadPct / 100);
  const costBase = subtotal + overheadAmount;
  const marginAmount = costBase * (marginPct / 100);
  const grandTotal = (costBase + marginAmount) * exchangeRate;
  const unitPrice = grandTotal / (formData.quantity || 1);

  // --- Render ---
  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList className="bg-transparent h-10 p-0 gap-1.5 shrink-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground h-10 text-xs px-3.5 font-medium rounded-none gap-1.5">
              <FileText className="w-4 h-4" />
              <span>{t("tabOverview")}</span>
            </TabsTrigger>
            <TabsTrigger value="costCalc" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground h-10 text-xs px-3.5 font-medium rounded-none gap-1.5">
              <DollarSign className="w-4 h-4" />
              <span>{t("tabCostCalc")}</span>
            </TabsTrigger>
            <TabsTrigger value="sample" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground h-10 text-xs px-3.5 font-medium rounded-none gap-1.5">
              <Package className="w-4 h-4" />
              <span>{t("tabSample")}</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground h-10 text-xs px-3.5 font-medium rounded-none gap-1.5">
              <History className="w-4 h-4" />
              <span>{t("tabAudit")}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium gap-1.5 text-zinc-600">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("printSpec")}</span>
            </Button>
            <Button onClick={handleSave} variant="outline" size="sm" className="h-7 text-xs font-medium gap-1.5">
              <Save className="w-3.5 h-3.5 text-zinc-600" />
              <span>{t("save")}</span>
            </Button>
            <Button onClick={handleSaveAndClose} size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none">
              <Check className="w-3.5 h-3.5" />
              <span>{t("postAndClose")}</span>
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">{t("status")}:</span>
                <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-300">
                  {formData.status}
                </Badge>
              </div>
              {formData.linkedWoId ? (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-medium">{t("linkedWo")}:</span>
                  <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                    {formData.linkedWoId}
                  </Badge>
                </div>
              ) : (
                <div className="text-zinc-400 italic text-[11px]">{t("noLinkedWo")}</div>
              )}
            </div>
            <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
              <span>{t("docNo")}: <strong className="text-zinc-800 dark:text-zinc-200">{data.docNo || tab.id}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <FileText className="w-4 h-4 text-blue-600" />
                Order Requisites
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{t("customerLabel")}</label>
                  <Input value={formData.customer} onChange={e => handleFieldChange("customer", e.target.value)} className="h-8 text-xs bg-zinc-50" />
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{t("productLabel")}</label>
                  <Input value={formData.product} onChange={e => handleFieldChange("product", e.target.value)} className="h-8 text-xs bg-zinc-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{t("quantityLabel")}</label>
                    <Input type="number" value={formData.quantity} onChange={e => handleFieldChange("quantity", Number(e.target.value))} className="h-8 text-xs bg-zinc-50" />
                  </div>
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{t("unitLabel")}</label>
                    <Select value={formData.unit} onValueChange={(val) => handleFieldChange("unit", val)}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">pcs</SelectItem>
                        <SelectItem value="rolls">rolls</SelectItem>
                        <SelectItem value="sets">sets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
               <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <Factory className="w-4 h-4 text-blue-600" />
                Production Parameters
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{t("recipeLabel")}</label>
                  <Select value={formData.recipe} onValueChange={(val) => handleFieldChange("recipe", val)}>
                    <SelectTrigger className="h-8 text-xs bg-zinc-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFSET_STD_V1">OFFSET_STD_V1</SelectItem>
                      <SelectItem value="FLEXO_NYLON_V1">FLEXO_NYLON_V1</SelectItem>
                      <SelectItem value="JACQ_WOVEN_V1">JACQ_WOVEN_V1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{t("deadlineLabel")}</label>
                  <DatePicker value={formData.deadline} onChange={(val) => handleFieldChange("deadline", val)} className="h-8 text-xs bg-zinc-50" />
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{t("responsibleLabel")}</label>
                  <Input value={formData.responsible} readOnly className="h-8 text-xs bg-zinc-100 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="costCalc" className="flex-1 overflow-y-auto p-4 m-0 flex gap-4">
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between p-1.5 px-3 bg-card border border-border rounded-md shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs text-muted-foreground">{t("calcModeLabel")}:</span>
                <Select value={calcMode} onValueChange={(val: any) => setCalcMode(val)}>
                  <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Auto">{t("calcModeAuto")}</SelectItem>
                    <SelectItem value="Manual">{t("calcModeManual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs text-muted-foreground">{t("currency")}:</span>
                <Select value={currency} onValueChange={(val) => setCurrency(val)}>
                  <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="UZS">UZS (so'm)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 bg-card border border-border rounded-md overflow-hidden relative min-h-[350px]">
              <DataEditor
                getCellContent={getCalcCell}
                columns={calcColumns}
                rows={materials.length + services.length}
                onCellEdited={onCellEdited}
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                rowMarkers="both"
                freezeColumns={1}
                smoothScrollX={true}
                smoothScrollY={true}
                width="100%"
                height="100%"
                headerHeight={28}
                rowHeight={30}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              />
            </div>
          </div>

          <div className="w-[280px] shrink-0 bg-card border border-border rounded-md p-4 flex flex-col">
            <h3 className="font-semibold text-foreground pb-2 border-b border-border mb-3">Order Summary</h3>
            
            <div className="space-y-2 text-xs flex-1">
              <div className="flex justify-between text-zinc-600">
                <span>{t("subtotalMaterials")}</span>
                <span className="font-mono">{materialsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>{t("subtotalServices")}</span>
                <span className="font-mono">{servicesTotal.toFixed(2)}</span>
              </div>
              
              <div className="pt-2 mt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-600">{t("overhead")}</span>
                  <Select value={String(overheadPct)} onValueChange={v => setOverheadPct(Number(v))}>
                    <SelectTrigger className="h-6 text-[10px] w-[60px] px-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px] mb-2">
                  <span>{t("overheadAmount")}</span>
                  <span className="font-mono">+{overheadAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-600">{t("margin")}</span>
                  <Select value={String(marginPct)} onValueChange={v => setMarginPct(Number(v))}>
                    <SelectTrigger className="h-6 text-[10px] w-[60px] px-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                      <SelectItem value="35">35%</SelectItem>
                      <SelectItem value="50">50%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>{t("marginAmount")}</span>
                  <span className="font-mono">+{marginAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 mt-3">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-semibold">{t("grandTotal")}</span>
                <span className="text-lg font-bold font-mono text-blue-600">{grandTotal.toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-zinc-500">
                <span>{t("unitPriceCalc")} (÷{formData.quantity})</span>
                <span className="font-mono font-medium">{unitPrice.toFixed(4)} {currency}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sample" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
          {/* Top Progress Pipeline & Order Type Selector */}
          <div className="bg-card border border-border rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            {/* Step indicators */}
            <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors", 
                formData.orderType === "Production"
                  ? "bg-muted text-muted-foreground"
                  : sampleData.isDispatched 
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                  : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              )}>
                <Truck className="w-3.5 h-3.5" />
                <span>1. Send Sample</span>
                {sampleData.isDispatched && formData.orderType === "Sample" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors",
                formData.orderType === "Production"
                  ? "bg-muted text-muted-foreground"
                  : sampleData.approvalStatus === "Approved"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : sampleData.approvalStatus === "Revision Requested"
                  ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  : sampleData.isDispatched
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                  : "text-muted-foreground bg-muted/40"
              )}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>2. Client Decision</span>
                {sampleData.approvalStatus === "Approved" && formData.orderType === "Sample" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />

              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors",
                formData.linkedWoId
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                  : (sampleData.approvalStatus === "Approved" || formData.orderType === "Production")
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground bg-muted/40"
              )}>
                <Factory className="w-3.5 h-3.5" />
                <span>3. Production Work Order</span>
                {formData.linkedWoId && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* Quick Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-md border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => handleFieldChange("orderType", "Sample")}
                className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer", 
                  formData.orderType === "Sample" 
                    ? "bg-background text-foreground font-semibold shadow-xs" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Physical Sample Run
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange("orderType", "Production")}
                className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer", 
                  formData.orderType === "Production" 
                    ? "bg-background text-foreground font-semibold shadow-xs" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Direct Production
              </button>
            </div>
          </div>

          {/* Mode A: Direct Production (No sample needed) */}
          {formData.orderType === "Production" ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800">
                <Factory className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-semibold text-sm text-foreground">Direct Production Order (No Sample Required)</h4>
                <p className="text-xs text-muted-foreground">
                  The client has directly confirmed the order without requesting a physical test sample. You can launch full manufacturing immediately for <strong>{formData.quantity.toLocaleString()} {formData.unit}</strong>.
                </p>
              </div>

              {formData.linkedWoId ? (
                <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-md text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Work Order Created: <strong>{formData.linkedWoId}</strong></span>
                </div>
              ) : (
                <div className="pt-2">
                  <Button 
                    onClick={() => setIsConfirmSendOpen(true)} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-6 gap-2 shadow-xs"
                  >
                    <Factory className="w-4 h-4" />
                    <span>Launch Production Work Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Mode B: Physical Sample Workflow (Guided 2 Cards + Action Footer) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 Card: Sample Dispatch */}
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-500" />
                        <h4 className="font-semibold text-xs text-foreground">1. Send Sample to Client</h4>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] font-semibold", 
                          sampleData.isDispatched 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400" 
                            : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400"
                        )}
                      >
                        {sampleData.isDispatched ? "✓ Dispatched" : "Awaiting Dispatch"}
                      </Badge>
                    </div>

                    {sampleData.isDispatched ? (
                      /* Compact Dispatched Summary */
                      <div className="p-3 bg-muted/40 border border-border rounded-md space-y-2 text-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Delivery Method:</span>
                            <span className="font-semibold text-foreground">{sampleData.deliveryMethod}</span>
                            {sampleData.courierName && <span className="text-muted-foreground"> ({sampleData.courierName})</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground block text-[11px]">Dispatched Date:</span>
                            <span className="font-medium text-foreground">{sampleData.dispatchDate}</span>
                          </div>
                        </div>

                        {sampleData.recipientName && (
                          <div className="pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
                            <span>Recipient: </span>
                            <strong className="text-foreground">{sampleData.recipientName}</strong>
                            {sampleData.recipientPhone && <span> • {sampleData.recipientPhone}</span>}
                          </div>
                        )}

                        {sampleData.trackingNumber && (
                          <div className="pt-1 border-t border-border/50 text-[11px]">
                            <span className="text-muted-foreground">Tracking #: </span>
                            <span className="font-mono font-medium text-foreground">{sampleData.trackingNumber}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Dispatch Form */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-muted-foreground font-medium block text-[11px] mb-1">Sample Qty (pcs)</label>
                            <Input 
                              type="number" 
                              value={sampleData.sampleQty} 
                              onChange={e => handleSampleChange("sampleQty", Number(e.target.value))} 
                              className="h-8 text-xs bg-background" 
                            />
                          </div>
                          <div>
                            <label className="text-muted-foreground font-medium block text-[11px] mb-1">Dispatch Date</label>
                            <DatePicker 
                              value={sampleData.dispatchDate} 
                              onChange={(v) => handleSampleChange("dispatchDate", v)} 
                              className="h-8 text-xs" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-muted-foreground font-medium block text-[11px] mb-1">Delivery Method</label>
                            <Select value={sampleData.deliveryMethod} onValueChange={(v) => handleSampleChange("deliveryMethod", v)}>
                              <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COURIER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-muted-foreground font-medium block text-[11px] mb-1">Tracking # (optional)</label>
                            <Input 
                              placeholder="e.g. YD-19482" 
                              value={sampleData.trackingNumber} 
                              onChange={e => handleSampleChange("trackingNumber", e.target.value)} 
                              className="h-8 text-xs bg-background" 
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-muted-foreground font-medium block text-[11px] mb-1">Recipient Name & Contact</label>
                          <Input 
                            placeholder="Customer contact person..." 
                            value={sampleData.recipientName} 
                            onChange={e => handleSampleChange("recipientName", e.target.value)} 
                            className="h-8 text-xs bg-background" 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-2">
                    {!sampleData.isDispatched ? (
                      <Button 
                        onClick={handleMarkDispatched} 
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Mark as Dispatched</span>
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleSampleChange("isDispatched", false)} 
                        variant="outline" 
                        size="sm"
                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        <span>Edit Dispatch Details</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 2 Card: Client Decision */}
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-xs text-foreground">2. Client Sample Review</h4>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] font-semibold", 
                          sampleData.approvalStatus === "Approved" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400" 
                            : sampleData.approvalStatus === "Revision Requested" 
                            ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400" 
                            : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400"
                        )}
                      >
                        {sampleData.approvalStatus}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground">Select the client's decision after inspecting the physical sample:</p>

                      {/* 3 Clickable Decision Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSampleChange("approvalStatus", "Pending")}
                          className={cn("p-2 rounded-md border text-center transition-all cursor-pointer",
                            sampleData.approvalStatus === "Pending"
                              ? "border-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                              : "border-border text-muted-foreground hover:border-zinc-300 hover:text-foreground"
                          )}
                        >
                          <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                          <span className="text-[11px] block">Waiting</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSampleChange("approvalStatus", "Revision Requested")}
                          className={cn("p-2 rounded-md border text-center transition-all cursor-pointer",
                            sampleData.approvalStatus === "Revision Requested"
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold shadow-xs"
                              : "border-border text-muted-foreground hover:border-amber-300 hover:text-foreground"
                          )}
                        >
                          <RotateCcw className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                          <span className="text-[11px] block">Revision</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSampleChange("approvalStatus", "Approved")}
                          className={cn("p-2 rounded-md border text-center transition-all cursor-pointer",
                            sampleData.approvalStatus === "Approved"
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs"
                              : "border-border text-muted-foreground hover:border-emerald-300 hover:text-foreground"
                          )}
                        >
                          <Check className="w-4 h-4 mx-auto mb-1 text-emerald-600 stroke-[3]" />
                          <span className="text-[11px] block">Approved</span>
                        </button>
                      </div>

                      {/* Notes for Revision */}
                      {sampleData.approvalStatus === "Revision Requested" && (
                        <div className="pt-1 space-y-1">
                          <label className="text-amber-800 dark:text-amber-400 font-medium block text-[11px]">
                            Revision Notes (What needs to change?):
                          </label>
                          <Textarea 
                            placeholder="e.g. Adjust Pantone color, increase thickness, change margin cut..." 
                            value={sampleData.approvalNotes} 
                            onChange={e => handleSampleChange("approvalNotes", e.target.value)} 
                            className="text-xs min-h-[60px] bg-background border-amber-200 dark:border-amber-800" 
                          />
                        </div>
                      )}

                      {/* Approval Success Banner */}
                      {sampleData.approvalStatus === "Approved" && (
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Client gave formal approval! Ready to manufacture mass batch.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Production Launch Footer Card */}
              <div className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 border",
                    formData.linkedWoId
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 border-blue-200"
                      : sampleData.approvalStatus === "Approved"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border-emerald-200"
                      : "bg-muted text-muted-foreground border-border"
                  )}>
                    <Factory className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">
                      {formData.linkedWoId ? "In Production" : "Step 3: Launch Mass Production"}
                    </h5>
                    <p className="text-[11px] text-muted-foreground">
                      {formData.linkedWoId 
                        ? `Linked Work Order: ${formData.linkedWoId}`
                        : sampleData.approvalStatus === "Approved"
                        ? `Ready to produce full batch: ${formData.quantity.toLocaleString()} ${formData.unit}`
                        : "Requires client sample approval before production can be launched"
                      }
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  {formData.linkedWoId ? (
                    <Badge variant="outline" className="h-8 px-3 text-xs bg-blue-50 text-blue-700 border-blue-300 font-mono">
                      ✓ {formData.linkedWoId}
                    </Badge>
                  ) : (
                    <Button 
                      onClick={() => setIsConfirmSendOpen(true)}
                      disabled={sampleData.approvalStatus !== "Approved"}
                      className="w-full sm:w-auto h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 gap-1.5 shadow-xs"
                    >
                      <Factory className="w-3.5 h-3.5" />
                      <span>Create Production Work Order</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="flex-1 p-4">
          <div className="text-sm text-zinc-500">Audit trail logs will appear here.</div>
        </TabsContent>

      </Tabs>

      <Dialog open={isConfirmSendOpen} onOpenChange={setIsConfirmSendOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("confirmSendTitle")}</DialogTitle>
            <DialogDescription>{t("confirmSendDesc")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm">
            <div className="flex justify-between border-b pb-1">
              <span className="text-zinc-500">Customer:</span>
              <span className="font-medium">{formData.customer}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-zinc-500">Product:</span>
              <span className="font-medium">{formData.product}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-zinc-500">Order Type:</span>
              <Badge variant="outline" className={formData.orderType === "Sample" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}>
                {formData.orderType.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Quantity to Produce:</span>
              <span className="font-mono font-bold">{formData.orderType === "Sample" ? sampleData.sampleQty : formData.quantity} {formData.unit}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmSendOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleCreateWorkOrder} className="bg-blue-600 hover:bg-blue-700 text-white">
              {t("confirmSendBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
