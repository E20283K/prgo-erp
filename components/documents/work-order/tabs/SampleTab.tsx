"use client";

import React, { useState } from "react";
import { cn } from "cn";
import { Truck, CheckCircle2, Factory, ChevronRight, Send, RotateCcw, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { ClientOrderFormData, ClientOrderSampleData } from "../types";

const COURIER_OPTIONS = ["Yandex Delivery", "UPS", "FedEx", "DHL", "Own driver", "Client pickup"];

interface Props {
  formData: ClientOrderFormData;
  sampleData: ClientOrderSampleData;
  handleSampleChange: (field: keyof ClientOrderSampleData, val: any) => void;
  handleFieldChange: (field: keyof ClientOrderFormData, val: any) => void;
  tabId: string;
}

export function SampleTab({ formData, sampleData, handleSampleChange, handleFieldChange, tabId }: Props) {
  const { addNotification, openTab } = useWorkspaceStore();
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);

  const handleMarkDispatched = () => {
    handleSampleChange("isDispatched", true);
    addNotification({
      title: `Sample dispatched for ${tabId}`,
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
        linkedOrderId: tabId,
        recipe: formData.recipe,
        deadline: formData.deadline,
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

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
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
                ? "bg-background text-foreground font-semibold shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Direct Production
          </button>
        </div>
      </div>

      {formData.orderType === "Production" ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-4 shadow-sm mt-4">
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
              {isConfirmSendOpen ? (
                <div className="space-y-2 max-w-sm mx-auto">
                  <p className="text-xs text-muted-foreground">Confirm sending this order to production?</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => setIsConfirmSendOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreateWorkOrder}>Confirm</Button>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={() => setIsConfirmSendOpen(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-6 gap-2 shadow-sm"
                >
                  <Factory className="w-4 h-4" />
                  <span>Launch Production Work Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Step 1: Dispatch */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between shadow-sm">
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
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-muted-foreground font-medium block text-[11px] mb-1">Sample Qty</label>
                      <Input type="number" value={sampleData.sampleQty} onChange={e => handleSampleChange("sampleQty", Number(e.target.value))} className="h-8 text-xs bg-background" />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-medium block text-[11px] mb-1">Dispatch Date</label>
                      <DatePicker value={sampleData.dispatchDate} onChange={(v) => handleSampleChange("dispatchDate", v)} className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-muted-foreground font-medium block text-[11px] mb-1">Method</label>
                      <Select value={sampleData.deliveryMethod} onValueChange={(v) => handleSampleChange("deliveryMethod", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COURIER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-muted-foreground font-medium block text-[11px] mb-1">Tracking #</label>
                      <Input value={sampleData.trackingNumber} onChange={e => handleSampleChange("trackingNumber", e.target.value)} className="h-8 text-xs bg-background" />
                    </div>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block text-[11px] mb-1">Recipient</label>
                    <Input value={sampleData.recipientName} onChange={e => handleSampleChange("recipientName", e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-2">
              {!sampleData.isDispatched ? (
                <Button onClick={handleMarkDispatched} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm">
                  <Send className="w-3.5 h-3.5" />
                  <span>Mark as Dispatched</span>
                </Button>
              ) : (
                <Button onClick={() => handleSampleChange("isDispatched", false)} variant="outline" size="sm" className="w-full h-7 text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  <span>Edit Dispatch</span>
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Decision */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between shadow-sm opacity-100">
            <div className={cn(!sampleData.isDispatched && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-xs text-foreground">2. Client Sample Review</h4>
                </div>
                <Badge variant="outline" className={cn("text-[10px] font-semibold", 
                  sampleData.approvalStatus === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                  sampleData.approvalStatus === "Revision Requested" ? "bg-amber-50 text-amber-700 border-amber-300" :
                  "bg-zinc-100 text-zinc-500"
                )}>
                  {sampleData.approvalStatus}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={sampleData.approvalStatus === "Approved" ? "default" : "outline"}
                    className={cn("h-16 flex flex-col gap-1", sampleData.approvalStatus === "Approved" && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => handleSampleChange("approvalStatus", "Approved")}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Approved</span>
                  </Button>
                  <Button 
                    variant={sampleData.approvalStatus === "Revision Requested" ? "default" : "outline"}
                    className={cn("h-16 flex flex-col gap-1", sampleData.approvalStatus === "Revision Requested" && "bg-amber-600 hover:bg-amber-700 text-white")}
                    onClick={() => handleSampleChange("approvalStatus", "Revision Requested")}
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Revision</span>
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="pt-4 mt-2 border-t border-border/50">
              {formData.linkedWoId ? (
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-md text-xs font-medium text-emerald-800 w-full justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Work Order: <strong>{formData.linkedWoId}</strong></span>
                </div>
              ) : (
                <Button 
                  onClick={handleCreateWorkOrder}
                  disabled={sampleData.approvalStatus !== "Approved"}
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-2 shadow-sm"
                >
                  <Factory className="w-4 h-4" />
                  <span>Launch Production</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
