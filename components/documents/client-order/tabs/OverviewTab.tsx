"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { 
  FileText, 
  Factory, 
  Ruler, 
  Plus, 
  X, 
  Tag, 
  Sparkles,
  Camera,
  Paperclip,
  Maximize2,
  Download,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import { ClientOrderFormData, SizeDistribution, OrderAttachment } from "../types";
import { cn } from "cn";
import { VerticalTaskTracker } from "@/components/ui/vertical-task-tracker";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import { FILE_KIND_ICON, getFileKind, isPreviewable, downloadFile, fileToAttachment, ViewableFile } from "@/components/file-viewer/file-utils";

interface Props {
  formData: ClientOrderFormData;
  handleFieldChange: (field: keyof ClientOrderFormData, val: any) => void;
  sizes: SizeDistribution[];
  handleSizesChange: (sizes: SizeDistribution[]) => void;
  docNo: string;
  orderAttachments: OrderAttachment[];
  setOrderAttachments: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  onOpenLightbox: () => void;
  onMarkUnsaved: () => void;
}

export function OverviewTab({ 
  formData, 
  handleFieldChange, 
  sizes, 
  handleSizesChange, 
  docNo,
  orderAttachments,
  setOrderAttachments,
  onOpenLightbox,
  onMarkUnsaved,
}: Props) {
  const t = useTranslations("ClientOrder");
  const [newSize, setNewSize] = useState("");
  const [newSizeQty, setNewSizeQty] = useState("");
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);

  const addSize = () => {
    if (!newSize || !newSizeQty) return;
    const qty = parseInt(newSizeQty);
    if (isNaN(qty) || qty <= 0) return;
    
    handleSizesChange([
      ...sizes,
      { id: Date.now().toString(), size: newSize, quantity: qty }
    ]);
    
    setNewSize("");
    setNewSizeQty("");
  };

  const removeSize = (id: string) => {
    handleSizesChange(sizes.filter(s => s.id !== id));
  };

  const handleMilestoneStatusChange = (milestoneId: string, newStatus: any) => {
    const updated = (formData.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, status: newStatus } : m
    );
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneAssign = (id: string, assignee: string) => {
    const updated = (formData.milestones || []).map((m) =>
      m.id === id ? { ...m, assignedTo: assignee } : m
    );
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneRemove = (id: string) => {
    const updated = (formData.milestones || []).filter((m) => m.id !== id);
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneAdd = (name: string, dept: string) => {
    const newM = {
      id: `m-custom-${Date.now()}`,
      name,
      department: dept || "General",
      status: "Pending" as const,
      assignedTo: "",
    };
    handleFieldChange("milestones", [...(formData.milestones || []), newM]);
  };

  const handleMilestonesReorder = (newMilestones: any[]) => {
    handleFieldChange("milestones", newMilestones);
  };

  return (
    <>
      <FilePreviewDialog 
        isOpen={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile} 
      />
      <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">{t("status") || "Status"}:</span>
            <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-300">
              {formData.status}
            </Badge>
          </div>
          {formData.linkedWoId ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">Linked WO:</span>
              <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                {formData.linkedWoId}
              </Badge>
            </div>
          ) : (
            <div className="text-zinc-400 italic text-[11px]">No Linked Work Order</div>
          )}
        </div>
        <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
          <span>{t("docNo") || "Doc No"}: <strong className="text-zinc-800 dark:text-zinc-200">{docNo}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Main Details */}
        <div className={cn("space-y-4", formData.milestones && formData.milestones.length > 0 ? "md:col-span-2" : "md:col-span-3")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Requisites */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <FileText className="w-4 h-4 text-blue-600" />
            Order Requisites
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-500 font-medium block mb-1">Customer</label>
              <Input value={formData.customer} onChange={e => handleFieldChange("customer", e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" />
            </div>
            <div>
              <label className="text-zinc-500 font-medium block mb-1">Product</label>
              <Input value={formData.product} onChange={e => handleFieldChange("product", e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Total Quantity</label>
                <Input 
                  type="number" 
                  value={formData.quantity} 
                  onChange={e => handleFieldChange("quantity", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                  readOnly={sizes.length > 0} 
                  title={sizes.length > 0 ? "Calculated from Size Breakdown" : ""}
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Unit</label>
                <Select value={formData.unit} onValueChange={(val) => handleFieldChange("unit", val)}>
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="rolls">rolls</SelectItem>
                    <SelectItem value="sets">sets</SelectItem>
                    <SelectItem value="sheets">sheets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Production Parameters */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
           <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Factory className="w-4 h-4 text-blue-600" />
            Production Parameters
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-500 font-medium block mb-1">Master Specification (Recipe)</label>
              <Select value={formData.recipe} onValueChange={(val) => handleFieldChange("recipe", val)}>
                <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFSET_STD_V1">OFFSET_STD_V1 (Carton)</SelectItem>
                  <SelectItem value="OFFSET_PREM_V2">OFFSET_PREM_V2 (Booklet)</SelectItem>
                  <SelectItem value="FLEXO_NYLON_V1">FLEXO_NYLON_V1 (Tape)</SelectItem>
                  <SelectItem value="FLEXO_SATIN_V2">FLEXO_SATIN_V2 (Label)</SelectItem>
                  <SelectItem value="JACQ_WOVEN_V1">JACQ_WOVEN_V1 (Damask)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-zinc-500 font-medium block mb-1">Department</label>
              <Select value={formData.department} onValueChange={(val) => handleFieldChange("department", val)}>
                <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offset">Offset</SelectItem>
                  <SelectItem value="Flexo">Flexo</SelectItem>
                  <SelectItem value="Jacquard">Jacquard</SelectItem>
                  <SelectItem value="Post-press">Post-press</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Deadline</label>
                <DatePicker value={formData.deadline} onChange={(val) => handleFieldChange("deadline", val)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Responsible</label>
                <Input value={formData.responsible} readOnly className="h-8 text-xs bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Physical Item Specifications */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>Physical Specifications</span>
            </h3>
            <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              {formData.width || 50} × {formData.height || 90} {formData.dimensionUnit || "mm"}
            </Badge>
          </div>

          <div className="space-y-2.5">
            {/* Quick Format Presets */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                <span>Quick Format Presets</span>
                <Sparkles className="w-3 h-3 text-amber-500" />
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { name: "Hangtag 50×90", w: 50, h: 90, cat: "Hangtag" },
                  { name: "Card 85×55", w: 85, h: 55, cat: "Card" },
                  { name: "Label 30×70", w: 30, h: 70, cat: "Label" },
                  { name: "Sticker 50×50", w: 50, h: 50, cat: "Sticker" },
                  { name: "A6 105×148", w: 105, h: 148, cat: "Card" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      handleFieldChange("width", preset.w);
                      handleFieldChange("height", preset.h);
                      handleFieldChange("itemCategory", preset.cat);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 dark:border-zinc-700 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Type / Category */}
            <div>
              <label className="text-zinc-500 font-medium block mb-1">Product Format / Type</label>
              <Select 
                value={formData.itemCategory || "Hangtag"} 
                onValueChange={(val) => handleFieldChange("itemCategory", val)}
              >
                <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hangtag">Hangtag (Clothing / Retail Tag)</SelectItem>
                  <SelectItem value="Label">Label (Self-adhesive / Woven / Care)</SelectItem>
                  <SelectItem value="Card">Card (Business / Insert / Postcard)</SelectItem>
                  <SelectItem value="Sticker">Sticker (Vinyl / Paper Die-cut)</SelectItem>
                  <SelectItem value="Jacquard Ribbon">Jacquard Ribbon (Woven band)</SelectItem>
                  <SelectItem value="Carton">Carton Box (Folding packaging)</SelectItem>
                  <SelectItem value="Other">Other Custom Format</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dimensions Grid (W, H, Unit) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Width (mm)</label>
                <Input 
                  type="number" 
                  value={formData.width ?? 50} 
                  onChange={(e) => handleFieldChange("width", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Height (mm)</label>
                <Input 
                  type="number" 
                  value={formData.height ?? 90} 
                  onChange={(e) => handleFieldChange("height", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Unit</label>
                <Select 
                  value={formData.dimensionUnit || "mm"} 
                  onValueChange={(val) => handleFieldChange("dimensionUnit", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cutting, Shape & Bleed */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Cut / Finish</label>
                <Select 
                  value={formData.cornerType || "Square"} 
                  onValueChange={(val) => handleFieldChange("cornerType", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Square">Square Cut</SelectItem>
                    <SelectItem value="Rounded (R3)">Round Corners (R3)</SelectItem>
                    <SelectItem value="Rounded (R5)">Round Corners (R5)</SelectItem>
                    <SelectItem value="Die-cut">Die-cut Contour</SelectItem>
                    <SelectItem value="Center Fold">Center Fold (Loop)</SelectItem>
                    <SelectItem value="End Fold">End Fold (Booklet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Bleed (mm)</label>
                <Input 
                  type="number" 
                  value={formData.bleed ?? 2} 
                  onChange={(e) => handleFieldChange("bleed", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono" 
                />
              </div>
            </div>

            {/* Paper Stock & Coating */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Paper Stock</label>
                <Input 
                  value={formData.paperStock || ""} 
                  onChange={(e) => handleFieldChange("paperStock", e.target.value)} 
                  placeholder="e.g. Galerie Art Silk 150g/m²"
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-medium" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Coating / Finish</label>
                <Input 
                  value={formData.coating || ""} 
                  onChange={(e) => handleFieldChange("coating", e.target.value)} 
                  placeholder="e.g. Soft-Touch Matte + Spot UV"
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-medium" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Size / Variation Breakdown */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600" />
              <span>Size Breakdown</span>
            </h3>
            <span className="text-[10px] text-muted-foreground font-normal">
              For apparel, cards, stickers
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Add Size Form */}
            <div className="flex items-end gap-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Size / Variation</label>
                <Input 
                  value={newSize} 
                  onChange={(e) => setNewSize(e.target.value)} 
                  placeholder="e.g. S, M, XL, 42" 
                  className="h-7 text-xs bg-white dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && addSize()}
                />
              </div>
              <div className="w-24">
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Quantity</label>
                <Input 
                  type="number"
                  value={newSizeQty} 
                  onChange={(e) => setNewSizeQty(e.target.value)} 
                  placeholder="0" 
                  className="h-7 text-xs bg-white dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && addSize()}
                />
              </div>
              <Button onClick={addSize} type="button" size="sm" className="h-7 px-2.5 gap-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            {/* Sizes List */}
            {sizes.length > 0 ? (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden max-h-[160px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Size</th>
                      <th className="px-2.5 py-1.5 font-medium w-24 text-right">Quantity</th>
                      <th className="px-2.5 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="px-2.5 py-1.5 font-medium">{item.size}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{item.quantity.toLocaleString()}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <button 
                            type="button" 
                            onClick={() => removeSize(item.id)}
                            className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 font-semibold sticky bottom-0">
                    <tr>
                      <td className="px-2.5 py-1.5 text-right">Total:</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">
                        {sizes.reduce((acc, s) => acc + s.quantity, 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-5 text-zinc-400 text-xs italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-md">
                No size breakdown specified. Using total order quantity.
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Order Photo & Sample Reference */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Order Photo & Sample Proof</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
              Visual Standard
            </Badge>
          </div>

          <div className="flex-1 flex flex-col justify-between space-y-3">
            {formData.photoUrl ? (
              <div className="space-y-2.5">
                <div className="relative group w-full h-44 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950/5 dark:bg-zinc-950 flex items-center justify-center">
                  <img 
                    src={formData.photoUrl} 
                    alt="Order Sample Proof" 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary" 
                      className="h-7 text-xs gap-1.5 shadow-md cursor-pointer"
                      onClick={onOpenLightbox}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full Screen</span>
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary" 
                      className="h-7 text-xs gap-1.5 shadow-md cursor-pointer"
                      onClick={() => document.getElementById("client-photo-change-input")?.click()}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Change Photo</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 font-medium">
                      Approved Match Proof
                    </Badge>
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Color Reference Standard</span>
                  </div>
                  <span className="font-mono text-[10px]">Target: ISO 12647-2</span>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex-1 min-h-[140px]"
                onClick={() => document.getElementById("client-photo-change-input")?.click()}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">No Sample Photo Attached</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Click to upload physical sample or packaging mockup</p>
              </div>
            )}

            <input 
              type="file" 
              id="client-photo-change-input" 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  handleFieldChange("photoUrl", url);
                  onMarkUnsaved();
                }
              }} 
            />
          </div>
        </div>

        {/* Card 6: Attached Files & Technical Documents */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span>Attached Files & Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono shadow-none">
                {orderAttachments.length} file{orderAttachments.length === 1 ? "" : "s"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 gap-1 rounded cursor-pointer"
                onClick={() => document.getElementById("client-doc-upload-input")?.click()}
              >
                <Plus className="w-3 h-3 text-blue-600" />
                <span>Attach</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {orderAttachments.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-1.5">
                {orderAttachments.map((file) => {
                  const fKind = getFileKind(file);
                  const fMeta = FILE_KIND_ICON[fKind];
                  const Icon = fMeta.icon;
                  const isLinkable = isPreviewable(file);

                  return (
                    <Attachment 
                      key={file.id} 
                      size="sm" 
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors shadow-none",
                        isLinkable && "cursor-pointer"
                      )}
                      onClick={isLinkable ? () => setPreviewFile(file) : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <AttachmentMedia variant={file.isImage ? "image" : "icon"} className="w-7 h-7 rounded shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <Icon className={cn("w-3.5 h-3.5", fMeta.className)} />
                        </AttachmentMedia>
                        <AttachmentContent className="min-w-0 flex-1">
                          <AttachmentTitle className={cn("text-xs font-medium truncate block text-zinc-900 dark:text-zinc-100", isLinkable && "hover:underline hover:text-blue-600 dark:hover:text-blue-400")}>{file.name}</AttachmentTitle>
                          <AttachmentDescription className="text-[10px] text-zinc-500 block">
                            {file.size} • {file.type} {file.date ? `• ${file.date}` : ""}
                          </AttachmentDescription>
                        </AttachmentContent>
                      </div>
                      <AttachmentActions className="shrink-0 ml-2 flex items-center gap-1">
                        {file.url && (
                          <AttachmentAction 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file);
                            }}
                            className="h-6 w-6 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded cursor-pointer"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </AttachmentAction>
                        )}
                        <AttachmentAction 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderAttachments(prev => prev.filter(f => f.id !== file.id));
                            onMarkUnsaved();
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive text-zinc-400 rounded cursor-pointer"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  );
                })}
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-md p-6 text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 transition-all flex-1 flex flex-col items-center justify-center min-h-[140px]"
                onClick={() => document.getElementById("client-doc-upload-input")?.click()}
              >
                <UploadCloud className="w-6 h-6 text-zinc-400 mb-1.5" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No attachments linked yet</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Click to attach vector die-lines, contracts, or customer specifications</p>
              </div>
            )}

            <input 
              type="file" 
              id="client-doc-upload-input" 
              className="hidden" 
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const newFiles = Array.from(e.target.files).map((f, i) => ({
                    id: `att-client-${Date.now()}-${i}`,
                    name: f.name,
                    size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
                    type: f.type || "Document",
                    date: new Date().toISOString().slice(0, 16).replace("T", " "),
                    isImage: f.type.startsWith("image/"),
                  }));
                  setOrderAttachments(prev => [...prev, ...newFiles]);
                  onMarkUnsaved();
                }
              }} 
            />
          </div>
        </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Route & Tasks Tracker (1/3 width) */}
        {formData.milestones && formData.milestones.length > 0 && (
          <div className="md:col-span-1 space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="text-sm flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  Live Production Route
                </span>
                <Badge variant="outline" className="text-[10px] shadow-none bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:border-blue-900">
                  {formData.linkedWoId ? `Linked to ${formData.linkedWoId}` : "Pre-production Route"}
                </Badge>
              </div>
              <div className="pt-2">
                <VerticalTaskTracker
                  milestones={formData.milestones || []}
                  onStatusChange={handleMilestoneStatusChange}
                  onAssign={handleMilestoneAssign}
                  onRemove={handleMilestoneRemove}
                  onAdd={handleMilestoneAdd}
                  onReorder={handleMilestonesReorder}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
