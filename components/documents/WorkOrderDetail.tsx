"use client";

import React, { useState } from "react";
import { 
  Save, 
  Check, 
  Printer, 
  ArrowLeft, 
  Clock, 
  Layers, 
  FileText, 
  History, 
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  Factory,
  Boxes,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

const BomMaterialsGrid = dynamic(
  () => import("./BomMaterialsGrid").then((mod) => mod.BomMaterialsGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        Loading BOM & Materials Grid...
      </div>
    ),
  }
);

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const tCommon = useTranslations("Common");
  const { setTabUnsaved, closeTab, setLevel3Tab } = useWorkspaceStore();
  const data = tab.documentData || {};
  
  const [formData, setFormData] = useState({
    customer: data.customer || "Alpha Media Group",
    product: data.product || "A4 Catalog 96 pages",
    quantity: data.quantity || 5000,
    unit: data.unit || "pcs",
    status: data.status || "Active",
    priority: data.priority || "High",
    pressMachine: data.pressMachine || "Heidelberg Speedmaster XL 106",
    startDate: data.startDate || "2026-09-30",
    deadline: data.deadline || "2026-10-06",
    paperStock: data.paperStock || "Galerie Art Silk 150g/m²",
    coating: data.coating || "Soft-Touch Matte + Spot UV",
    priceTotal: data.priceTotal || 14850.00,
    currency: data.currency || "USD",
  });

  const activeTab = tab.activeLevel3Tab || "overview";

  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
  };

  const handleSaveAndClose = () => {
    setTabUnsaved(tab.id, false);
    closeTab(tab.id);
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      {/* Document Action Toolbar (1C Standard) */}
      <div className="h-11 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Primary 1C Post & Close Button */}
          <Button 
            onClick={handleSaveAndClose}
            size="sm" 
            className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{tOrder("postAndClose")}</span>
          </Button>

          {/* Secondary Save */}
          <Button 
            onClick={handleSave}
            variant="outline" 
            size="sm" 
            className="h-7 border-zinc-300 dark:border-zinc-700 text-xs font-medium gap-1.5 rounded"
          >
            <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>{tOrder("save")}</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-300 rounded"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tOrder("printSpec")}</span>
          </Button>

        </div>
      </div>

      {/* Level 3 Tabs Navigation for the Document */}
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <TabsList className="bg-transparent h-10 p-0 gap-1.5">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150"
            >
              <FileText className="w-4 h-4" />
              <span>{tOrder("tabOverview")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="materials" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150"
            >
              <Boxes className="w-4 h-4" />
              <span>{tOrder("tabMaterials")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="operations" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150"
            >
              <Factory className="w-4 h-4" />
              <span>{tOrder("tabOperations")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="timeline" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150"
            >
              <Clock className="w-4 h-4" />
              <span>{tOrder("tabTimeline")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150"
            >
              <History className="w-4 h-4" />
              <span>{tOrder("tabHistory")}</span>
            </TabsTrigger>
          </TabsList>
        </div>


        {/* Tab 1: Overview Form */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
          {/* Document Status Header */}
          <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">{tOrder("status")}:</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  {formData.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">{tOrder("priority")}:</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  {formData.priority}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
              <span>{tOrder("docNo")}: <strong className="text-zinc-800 dark:text-zinc-200">{data.docNo || tab.id}</strong></span>
              <span>{tOrder("created")}: 2026-09-29 14:20</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* General Info Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>{tOrder("docRequisites")}</span>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("customerLabel")}</label>
                  <Input 
                    value={formData.customer} 
                    onChange={(e) => handleFieldChange("customer", e.target.value)}
                    className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                  />
                </div>

                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("productLabel")}</label>
                  <Input 
                    value={formData.product} 
                    onChange={(e) => handleFieldChange("product", e.target.value)}
                    className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("quantityLabel")}</label>
                    <Input 
                      type="number"
                      value={formData.quantity} 
                      onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                      className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono" 
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("unitLabel")}</label>
                    <Input 
                      value={formData.unit} 
                      onChange={(e) => handleFieldChange("unit", e.target.value)}
                      className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Production Requisites */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                <Factory className="w-3.5 h-3.5 text-blue-600" />
                <span>{tOrder("workshopEquipment")}</span>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("machineLabel")}</label>
                  <Input 
                    value={formData.pressMachine} 
                    onChange={(e) => handleFieldChange("pressMachine", e.target.value)}
                    className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("shiftStartLabel")}</label>
                    <Input 
                      type="date"
                      value={formData.startDate} 
                      onChange={(e) => handleFieldChange("startDate", e.target.value)}
                      className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("deadlineLabel")}</label>
                    <Input 
                      type="date"
                      value={formData.deadline} 
                      onChange={(e) => handleFieldChange("deadline", e.target.value)}
                      className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("coatingLabel")}</label>
                  <Input 
                    value={formData.coating} 
                    onChange={(e) => handleFieldChange("coating", e.target.value)}
                    className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" 
                  />
                </div>
              </div>
            </div>

            {/* Finance & Costing Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                <span>Financial Calculation</span>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 font-mono">
                  <div className="flex justify-between text-zinc-500 mb-1">
                    <span>Base Paper Cost:</span>
                    <span>$6,420.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 mb-1">
                    <span>Offset Printing:</span>
                    <span>$4,100.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 mb-1">
                    <span>Post-press & Binding:</span>
                    <span>$2,830.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 mb-2">
                    <span>Packaging & Delivery:</span>
                    <span>$1,500.00</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                    <span>Total Amount:</span>
                    <span className="text-blue-600 dark:text-blue-400">${formData.priceTotal.toLocaleString("en-US")} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Materials BOM (Glide Data Grid) */}
        <TabsContent value="materials" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
          <BomMaterialsGrid tabId={tab.id} />
        </TabsContent>

        {/* Tab 3: Technological Route */}
        <TabsContent value="operations" className="flex-1 overflow-y-auto p-4 m-0">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-950 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              Operations & Equipment Sequence (Technological Route)
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center font-bold text-[10px]">1</span>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">Pre-press & CTP Plate Imaging</div>
                    <div className="text-zinc-500 text-[11px]">Station: Screen PlateRite 8600 • Operator: N. Smirnov</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-600">Finished</span>
              </div>

              <div className="p-3 flex items-center justify-between bg-blue-50/30 dark:bg-blue-950/20">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">4+4 Offset Printing</div>
                    <div className="text-zinc-500 text-[11px]">Station: Heidelberg Speedmaster XL 106 • Operator: K. Anderson</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-600">In Progress (62%)</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold text-[10px]">3</span>
                  <div>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">Thermal Lamination & Spot UV Coating</div>
                    <div className="text-zinc-500 text-[11px]">Station: Autobond Mini 76 • Queue #2</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Queued</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold text-[10px]">4</span>
                  <div>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">Folding, Stitching & Hardcover Binding</div>
                    <div className="text-zinc-500 text-[11px]">Station: Kolbus BF 513 Line</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Queued</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 p-4 m-0 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Shift Allocation & Timeline
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">Est. Time: 4h 15m</Badge>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-none text-[10px]">On Schedule</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Shift Assignment Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 col-span-1">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Assignment Details
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Assigned Shift</label>
                  <Select defaultValue="day-shift">
                    <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day-shift">Day Shift (08:00 - 20:00)</SelectItem>
                      <SelectItem value="night-shift">Night Shift (20:00 - 08:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Shift Lead / Operator</label>
                  <Select defaultValue="k-anderson">
                    <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="k-anderson">K. Anderson (Senior Pressman)</SelectItem>
                      <SelectItem value="m-ivanova">M. Ivanova</SelectItem>
                      <SelectItem value="a-petrov">A. Petrov</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Machine</label>
                  <Input disabled value={formData.pressMachine} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-500" />
                </div>
              </div>
            </div>

            {/* Timeline Visualizer Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-4 col-span-1 lg:col-span-2">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800 flex justify-between">
                <span>Execution Timeline (14:00 - 18:15)</span>
                <span className="text-zinc-500 font-mono text-[10px]">Current Time: 15:30</span>
              </div>
              
              <div className="space-y-1">
                {/* Visual Bar */}
                <div className="h-6 w-full rounded overflow-hidden flex font-mono text-[9px] font-bold text-white text-center leading-6 shadow-inner">
                  <div className="bg-amber-500 w-[15%]" title="Setup / Make-Ready: 40 mins">SETUP</div>
                  <div className="bg-blue-600 w-[75%] relative" title="Print Run: 3 hrs 20 mins">
                    RUN
                    {/* Current time indicator */}
                    <div className="absolute top-0 bottom-0 left-[45%] w-0.5 bg-black/50 z-10 shadow-[0_0_2px_rgba(255,255,255,0.5)]"></div>
                  </div>
                  <div className="bg-emerald-500 w-[10%]" title="Wash-up / Maintenance: 15 mins">WASH</div>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>14:00</span>
                  <span>14:40</span>
                  <span className="text-blue-600 font-bold ml-10">15:30 (Now)</span>
                  <span>18:00</span>
                  <span>18:15</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Completed (Est)</span>
                  <span className="font-mono text-sm font-semibold text-emerald-600">38%</span>
                </div>
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Impressions</span>
                  <span className="font-mono text-sm font-semibold text-blue-600">1,900 / 5,000</span>
                </div>
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Speed</span>
                  <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">12,500 sh/hr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Downtime / Delay Log */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-950 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-xs flex justify-between items-center">
              <span>Shift Event & Downtime Log</span>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 py-0 border-zinc-300">
                Log Event
              </Button>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]">
              <div className="p-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:00</span>
                  <Badge variant="outline" className="text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200">Setup</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">Machine setup & plates loaded</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:15</span>
                  <Badge variant="outline" className="text-[9px] bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200">Delay</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium text-red-600 dark:text-red-400">Waiting for paper delivery from warehouse</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
              <div className="p-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:40</span>
                  <Badge variant="outline" className="text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200">Run</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">Print run started</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 p-4 m-0">
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-500 font-mono text-[11px]">
            [2026-09-29 14:20:00] Document created by K. Anderson (Prepress Lead)<br/>
            [2026-09-29 15:45:12] Status changed to &quot;Active&quot; by Shift Supervisor<br/>
            [2026-09-29 16:30:00] Material Reservation confirmed in Warehouse DB
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
