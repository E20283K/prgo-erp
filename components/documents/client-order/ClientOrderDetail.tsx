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
  LayoutTemplate,
  Disc,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ui/image-lightbox";

import { ClientOrderFormData, ClientOrderSampleData, SizeDistribution, OrderAttachment, AuditLogItem } from "./types";
import { EXAMPLE_ATTACHMENTS } from "@/components/file-viewer/file-utils";
import { OverviewTab } from "./tabs/OverviewTab";
import { CostCalcTab } from "./tabs/CostCalcTab";
import { SampleTab } from "./tabs/SampleTab";
import { AuditTab } from "./tabs/AuditTab";
import { LayoutCalcTab } from "./tabs/LayoutCalcTab";
import { FlexoCalcTab } from "./tabs/FlexoCalcTab";
import { calculateFlexoLayout } from "@/lib/flexo/calculator";
import { exportFlexoPDF } from "@/lib/flexo/pdfExport";
import { pdf } from "@react-pdf/renderer";
import { OrderSpecificationPDF } from "./OrderSpecificationPDF";

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
    photoUrls: data.photoUrls || [
      data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
      "/sample-proof.jpg",
      "/files_example/PrintGoo CMYK Label Logo.png"
    ],
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
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);

  const isFlexo = formData.department === "Flexo" || (formData.recipe && formData.recipe.startsWith("FLEXO_"));
  const isOffset = formData.department === "Offset" || (formData.recipe && formData.recipe.startsWith("OFFSET_"));
  const effectiveActiveTab = activeTab === "layout" && isFlexo && !isOffset ? "flexo" : activeTab;

  // --- Handlers ---
  const handleAuditLog = useCallback((action: string, detail: string) => {
    const newItem: AuditLogItem = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      detail,
      user: currentUser.name || "Operator",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setAuditEvents((prev) => [newItem, ...prev]);
    setTabUnsaved(tab.id, true);
  }, [currentUser.name, tab.id, setTabUnsaved]);

  const handleFieldChange = useCallback((field: keyof ClientOrderFormData, val: any) => {
    setFormData((prev) => {
      if (prev[field] === val) return prev;
      return { ...prev, [field]: val };
    });
    setTabUnsaved(tab.id, true);
  }, [tab.id, setTabUnsaved]);

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
    handleAuditLog("Document Saved", `Status: ${formData.status}`);
  };

  const handleSaveAndClose = () => {
    handleSave();
    closeTab(tab.id);
  };

  const handlePrintSpec = async () => {
    if (isFlexo) {
      const inputs = {
        machineId: formData.flexoMachineId || "JR-1521",
        materialId: formData.flexoMaterialId || "satin-white",
        webWidth: formData.flexoWebWidth || 35,
        sideMarginLeft: 2.5,
        sideMarginRight: 2.5,
        productWidth: formData.width || 30,
        productHeight: formData.height || 65,
        orientation: (formData.flexoOrientation as any) || "normal",
        bleedX: formData.bleed || 1.5,
        bleedY: formData.bleed || 1.5,
        gapX: formData.flexoGapX || 2,
        gapY: formData.flexoGapY || 2.5,
        cylinderTeeth: formData.flexoCylinderTeeth || 100,
        plateThickness: formData.flexoPlateThickness || 1.7,
        colors: formData.flexoColors || 4,
        requiredQuantity: formData.quantity || 10000,
        overproductionMode: "percent" as const,
        overproductionValue: 5,
      };
      const result = calculateFlexoLayout(inputs);
      exportFlexoPDF(result, {
        docNo: data.docNo || tab.id,
        orderName: formData.product,
        customer: formData.customer,
        productName: formData.product,
      });
      handleAuditLog("Exported Flexo Spec", `PDF generated for cylinder ${result.gearTeeth}T`);
    } else {
      try {
        const docNo = data.docNo || tab.id;
        const blob = await pdf(
          <OrderSpecificationPDF
            docNo={docNo}
            orderData={formData}
            sizes={sizes}
            sampleData={sampleData}
          />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Order_Spec_${docNo || "PRINTGOO"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        handleAuditLog("Exported Order Spec", `Generated React-PDF spec for ${docNo}`);
        addNotification({
          title: "Specification Generated",
          description: `Downloaded specification for ${docNo}`,
          severity: "success",
        });
      } catch (err) {
        console.error("Failed to generate order spec PDF", err);
        if (typeof window !== "undefined") {
          window.print();
        }
      }
    }
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      <Tabs 
        value={effectiveActiveTab} 
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList variant="line" className="gap-2 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger value="overview" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5" />
              <span>{t("tabOverview") || "Overview"}</span>
            </TabsTrigger>
            {(!isFlexo || isOffset) && (
              <TabsTrigger value="layout" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>{t("tabLayout") || "Layout"}</span>
              </TabsTrigger>
            )}
            {isFlexo && (
              <TabsTrigger value="flexo" className="h-9 text-xs px-3 font-medium gap-1.5 shrink-0">
                <Disc className="w-3.5 h-3.5 text-blue-600" />
                <span>{t("tabFlexo") || "Flexo"}</span>
              </TabsTrigger>
            )}
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
            <Button onClick={handlePrintSpec} variant="ghost" size="sm" className="h-7 text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-300">
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
        
        {(!isFlexo || isOffset) && (
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
        )}

        {isFlexo && (
          <TabsContent value="flexo" className="flex-1 overflow-y-auto p-3 m-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <FlexoCalcTab 
              defaultQuantity={formData.quantity}
              docNo={data.docNo || tab.id}
              orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
              customer={formData.customer}
              productName={formData.product}
              defaultProdW={formData.width}
              defaultProdH={formData.height}
              defaultBleed={formData.bleed}
              onAuditLog={handleAuditLog}
              onFlexoSave={(res) => {
                if (
                  formData.flexoCylinderTeeth !== res.gearTeeth ||
                  formData.flexoWebWidth !== res.webWidth
                ) {
                  setFormData((prev) => ({
                    ...prev,
                    flexoCylinderTeeth: res.gearTeeth,
                    flexoWebWidth: res.webWidth,
                  }));
                }
              }}
            />
          </TabsContent>
        )}

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
          <AuditTab events={auditEvents} />
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
