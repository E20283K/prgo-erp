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
  LayoutTemplate
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ui/image-lightbox";

import { ClientOrderFormData, ClientOrderSampleData, SizeDistribution, OrderAttachment } from "./types";
import { EXAMPLE_ATTACHMENTS } from "@/components/file-viewer/file-utils";
import { OverviewTab } from "./tabs/OverviewTab";
import { CostCalcTab } from "./tabs/CostCalcTab";
import { SampleTab } from "./tabs/SampleTab";
import { AuditTab } from "./tabs/AuditTab";
import { LayoutCalcTab } from "./tabs/LayoutCalcTab";

export function ClientOrderDetail({ tab }: { tab: DocumentTab }) {
  const t = useTranslations("ClientOrder");
  const { setTabUnsaved, closeTab, setLevel3Tab, theme, openTab, addNotification, currentUser } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  const activeTab = tab.activeLevel3Tab || "overview";

  // --- State: Overview ---
  const [formData, setFormData] = useState<ClientOrderFormData>({
    customer: data.customer || "",
    product: data.product || "",
    quantity: data.quantity || 1000,
    unit: data.unit || "pcs",
    recipe: data.recipe || "OFFSET_STD_V1",
    department: data.department || "Offset",
    site: data.site || "Building 1",
    deadline: data.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    responsible: data.responsible || currentUser.name,
    orderType: data.orderType || "Production",
    linkedWoId: data.linkedWoId ?? "",
    status: data.status || "Draft",
    priority: data.priority || "High",
    itemCategory: data.itemCategory || "Hangtag",
    width: data.width || 50,
    height: data.height || 90,
    dimensionUnit: data.dimensionUnit || "mm",
    cornerType: data.cornerType || "Square",
    bleed: data.bleed || 2,
    paperStock: data.paperStock || "Galerie Art Silk 150g/m²",
    coating: data.coating || "Soft-Touch Matte + Spot UV",
    priceTotal: data.priceTotal || 14850.0,
    currency: data.currency || "USD",
    photoUrl: data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    milestones: data.milestones || [
      { id: "m1", name: "Preflight File", department: "Prepress", status: "Done", assignedTo: "Prepress Dept" },
      { id: "m2", name: "Materials", department: "Warehouse", status: "Done", assignedTo: "Warehouse Dept" },
      { id: "m3", name: "CTP Plates", department: "Prepress", status: "In Progress", assignedTo: "K. Anderson (Prepress)" },
      { id: "m4", name: "Printing", department: "Offset", status: "Pending", assignedTo: "Press Dept" },
      { id: "m5", name: "Post-press", department: "Finishing", status: "Pending", assignedTo: "Finishing Dept" }
    ]
  });

  const [orderAttachments, setOrderAttachments] = useState<OrderAttachment[]>(
    data.attachments || EXAMPLE_ATTACHMENTS
  );

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [sizes, setSizes] = useState<SizeDistribution[]>(data.sizes || []);

  // --- State: Physical Sample ---
  const [sampleData, setSampleData] = useState<ClientOrderSampleData>({
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

  const [currency, setCurrency] = useState(data.currency || "USD");
  
  // --- Handlers ---
  const handleFieldChange = (field: keyof ClientOrderFormData, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSampleChange = (field: keyof ClientOrderSampleData, val: any) => {
    setSampleData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSizesChange = (newSizes: SizeDistribution[]) => {
    setSizes(newSizes);
    const total = newSizes.reduce((sum, s) => sum + s.quantity, 0);
    if (total > 0 || newSizes.length > 0) {
      handleFieldChange("quantity", total);
    }
    setTabUnsaved(tab.id, true);
  };

  const handleSave = () => {
    // In a real app, this would mutate backend state
    setTabUnsaved(tab.id, false);
    if (formData.status === "Draft") {
      handleFieldChange("status", "Calculating");
    }
  };

  const handleSaveAndClose = () => {
    handleSave();
    closeTab(tab.id);
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList variant="line" className="gap-2 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger value="overview" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5" />
              <span>{t("tabOverview") || "Overview"}</span>
            </TabsTrigger>
            <TabsTrigger value="layout" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>Layout</span>
            </TabsTrigger>
            <TabsTrigger value="costCalc" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t("tabCostCalc") || "Costing"}</span>
            </TabsTrigger>
            <TabsTrigger value="sample" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <Package className="w-3.5 h-3.5" />
              <span>{t("tabSample") || "Sample"}</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <History className="w-3.5 h-3.5" />
              <span>{t("tabAudit") || "History"}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-300">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("printSpec") || "Print"}</span>
            </Button>
            <Button onClick={handleSave} variant="outline" size="sm" className="h-7 text-xs font-medium gap-1.5 border-zinc-300 dark:border-zinc-700">
              <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>{t("save") || "Save"}</span>
            </Button>
            <Button onClick={handleSaveAndClose} size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none">
              <Check className="w-3.5 h-3.5" />
              <span>{t("postAndClose") || "Close"}</span>
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto p-3 m-0 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <OverviewTab 
            formData={formData}
            handleFieldChange={handleFieldChange}
            sizes={sizes}
            handleSizesChange={handleSizesChange}
            docNo={data.docNo || tab.id}
            orderAttachments={orderAttachments}
            setOrderAttachments={setOrderAttachments}
            onOpenLightbox={() => setIsLightboxOpen(true)}
            onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
          />
        </TabsContent>
        
        <TabsContent value="layout" className="flex-1 overflow-y-auto p-3 m-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <LayoutCalcTab 
            sizes={sizes}
            defaultQuantity={formData.quantity}
            docNo={data.docNo || tab.id}
            orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
            defaultProdW={formData.width}
            defaultProdH={formData.height}
            defaultBleed={formData.bleed}
          />
        </TabsContent>

        <TabsContent value="costCalc" className="flex-1 overflow-y-auto p-3 m-0 flex gap-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <CostCalcTab 
            recipe={formData.recipe}
            quantity={formData.quantity}
            currency={currency}
            setCurrency={setCurrency}
            isDark={isDark}
          />
        </TabsContent>

        <TabsContent value="sample" className="flex-1 overflow-y-auto p-3 m-0 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <SampleTab 
            formData={formData}
            sampleData={sampleData}
            handleSampleChange={handleSampleChange}
            handleFieldChange={handleFieldChange}
            tabId={tab.id}
          />
        </TabsContent>

        <TabsContent value="audit" className="flex-1 overflow-y-auto p-3 m-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <AuditTab />
        </TabsContent>
      </Tabs>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={formData.photoUrl || ""}
        alt="Sample Proof"
        title={`${formData.customer || "Order"} - ${formData.product || "Sample Proof"}`}
        subtitle="Planning Visual Reference Standard"
      />
    </div>
  );
}
