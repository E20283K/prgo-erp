"use client";

import React from "react";
import { cn } from "cn";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Boxes, Paperclip, UploadCloud, X, FileText, Image as ImageIcon, Camera } from "lucide-react";
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";

const orderSchema = z.object({
  customer: z.string().min(1, "Customer is required"),
  product: z.string().min(1, "Product description is required"),
  department: z.enum(["Offset", "Flexo", "Jacquard", "Post-press"]),
  site: z.enum(["Building 1", "Building 2"]),
  recipe: z.string().min(1, "Recipe is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit: z.string().min(1, "Unit is required"),
  machine: z.string().min(1, "Machine is required"),
  deadline: z.string().min(1, "Deadline is required"),
  priority: z.enum(["Normal", "High", "Urgent"]),
});

type OrderFormValues = z.infer<typeof orderSchema>;

const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; stock: number }[]> = {
  "OFFSET_STD_V1": [
    { name: "Galerie Art Silk Paper 150g", req: 12500, unit: "Sheets", stock: 45000 },
    { name: "Hubergroup CMYK Ink", req: 36, unit: "kg", stock: 120 },
    { name: "Agfa CTP Plates", req: 24, unit: "pcs", stock: 8 }, // Shortage
  ],
  "OFFSET_PREM_V2": [
    { name: "LumiForte Premium 250g", req: 5000, unit: "Sheets", stock: 2000 }, // Shortage
    { name: "Spot UV Varnish", req: 15, unit: "kg", stock: 50 },
  ],
  "FLEXO_NYLON_V1": [
    { name: "Nylon Taffeta Tape 30mm", req: 45, unit: "Rolls", stock: 120 },
    { name: "Wash-Resistant Ink Black", req: 2, unit: "kg", stock: 1 }, // Shortage
  ],
  "FLEXO_SATIN_V2": [
    { name: "Premium Satin Ribbon 40mm", req: 30, unit: "Rolls", stock: 200 },
    { name: "Metallic Gold Ink", req: 1.5, unit: "kg", stock: 5 },
  ],
  "JACQ_WOVEN_V1": [
    { name: "Polyester Warp Yarn Black", req: 120, unit: "kg", stock: 500 },
    { name: "Polyester Weft Yarn White", req: 85, unit: "kg", stock: 400 },
  ],
  "JACQ_TAFFETA_V2": [
    { name: "High-density Taffeta Yarn", req: 200, unit: "kg", stock: 50 }, // Shortage
  ],
};

const MOCK_CUSTOMERS = [
  "Alpha Media Group",
  "Nordic Print Co",
  "Baltic Press LLC",
  "Apex Packaging",
  "Global Apparel Brand",
  "Zenith Publishing",
  "Vanguard Fashion",
  "Metropolis Books",
  "Urban Outfit Labels",
  "Pacific Craft Goods",
];

export function CreateOrderDialog() {
  const t = useTranslations("CreateOrder");
  const { isCreateOrderOpen, setCreateOrderOpen, openTab, currentUser } = useWorkspaceStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer: "",
      product: "",
      department: "Offset",
      site: "Building 1",
      recipe: "OFFSET_STD_V1",
      quantity: 1000,
      unit: "pcs",
      machine: "",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      priority: "Normal",
    },
  });

  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [orderPhoto, setOrderPhoto] = React.useState<File | null>(null);
  const [orderPhotoPreview, setOrderPhotoPreview] = React.useState<string | null>(null);

  const watchCustomer = watch("customer");
  const watchUnit = watch("unit");
  const watchPriority = watch("priority");
  const watchSite = watch("site");
  const watchRecipe = watch("recipe");
  const watchDeadline = watch("deadline");

  const MACHINE_MAP: Record<string, string[]> = {
    Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
    Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
    Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
    "Post-press": ["Kolbus BF 513", "Bobst Novacut 106"]
  };

  const RECIPE_DEPT_MAP: Record<string, "Offset" | "Flexo" | "Jacquard" | "Post-press"> = {
    "OFFSET_STD_V1": "Offset",
    "OFFSET_PREM_V2": "Offset",
    "FLEXO_NYLON_V1": "Flexo",
    "FLEXO_SATIN_V2": "Flexo",
    "FLEXO_TYVEK_V3": "Flexo",
    "JACQ_WOVEN_V1": "Jacquard",
    "JACQ_TAFFETA_V2": "Jacquard",
    "POST_GENERIC_V1": "Post-press"
  };

  React.useEffect(() => {
    // When the user selects a Master Specification, it automatically dictates the technology and primary machine
    const dept = RECIPE_DEPT_MAP[watchRecipe];
    if (dept) {
      setValue("department", dept);
      const machines = MACHINE_MAP[dept];
      if (machines && machines.length > 0) {
        setValue("machine", machines[0]);
      }
    }
  }, [watchRecipe, setValue]);

  const onSubmit = (data: OrderFormValues) => {
    const newId = `WO-00${Math.floor(100 + Math.random() * 900)}`;
    
    openTab({
      id: newId,
      title: `${newId}: ${data.product}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newId,
        customer: data.customer,
        product: data.product,
        department: data.department,
        site: data.site,
        recipe: data.recipe,
        quantity: data.quantity,
        unit: data.unit,
        status: "Draft",
        priority: data.priority,
        pressMachine: data.machine,
        startDate: new Date().toISOString().split('T')[0],
        deadline: data.deadline,
        priceTotal: 0,
        currency: "USD",
        responsible: currentUser?.name || "Unassigned",
        photoUrl: orderPhotoPreview,
        attachmentsCount: attachments.length,
      },
    });

    reset();
    setAttachments([]);
    setOrderPhoto(null);
    setOrderPhotoPreview(null);
    setCreateOrderOpen(false);
  };

  return (
    <Sheet open={isCreateOrderOpen} onOpenChange={(open) => {
      if (!open) {
        reset();
        setAttachments([]);
        setOrderPhoto(null);
        setOrderPhotoPreview(null);
      }
      setCreateOrderOpen(open);
    }}>
      <SheetContent side="right" className="sm:max-w-[680px] w-full p-0 flex flex-col h-full bg-background border-l border-border">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0 bg-muted/20">
          <SheetTitle className="text-base font-semibold text-foreground">{t("title")}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">{t("desc")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("customer")} <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={watchCustomer}
                onChange={(val) => setValue("customer", val, { shouldValidate: true })}
                options={MOCK_CUSTOMERS.map((c) => ({ value: c, label: c }))}
                placeholder="Select or search customer..."
                searchPlaceholder="Search customer or organization..."
                className="h-8 text-xs bg-white dark:bg-zinc-950"
                popoverClassName="w-auto min-w-[280px]"
              />
              {errors.customer && <span className="text-[11px] text-destructive">{errors.customer.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("product")} <span className="text-destructive">*</span></label>
              <Input {...register("product")} className="h-8 text-xs" placeholder="e.g. Brochure A4" />
              {errors.product && <span className="text-[11px] text-destructive">{errors.product.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("quantity")} <span className="text-destructive">*</span></label>
              <Input type="number" {...register("quantity", { valueAsNumber: true })} className="h-8 text-xs" />
              {errors.quantity && <span className="text-[11px] text-destructive">{errors.quantity.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("unit")} <span className="text-destructive">*</span></label>
              <Select value={watchUnit} onValueChange={(val: string | null) => val && setValue("unit", val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs (Pieces)</SelectItem>
                  <SelectItem value="sets">sets (Sets)</SelectItem>
                  <SelectItem value="kg">kg (Kilograms)</SelectItem>
                  <SelectItem value="m">m (Meters)</SelectItem>
                </SelectContent>
              </Select>
              {errors.unit && <span className="text-[11px] text-destructive">{errors.unit.message}</span>}
            </div>

            <div className="space-y-1.5 md:col-span-2 mt-2">
              <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Master Product Specification <span className="text-destructive">*</span></label>
              <div className="text-[10px] text-zinc-500 mb-1">
                Selecting this will automatically configure the required materials, production technology, and default routing sequence.
              </div>
              <FieldCombobox
                value={watchRecipe}
                onChange={(val) => setValue("recipe", val, { shouldValidate: true })}
                options={[
                  { value: "OFFSET_STD_V1", label: "OFFSET_STD_V1 (Standard CMYK Carton)" },
                  { value: "OFFSET_PREM_V2", label: "OFFSET_PREM_V2 (Premium Spot UV Booklet)" },
                  { value: "FLEXO_NYLON_V1", label: "FLEXO_NYLON_V1 (Nylon Taffeta Tape)" },
                  { value: "FLEXO_SATIN_V2", label: "FLEXO_SATIN_V2 (Premium Satin Label)" },
                  { value: "FLEXO_TYVEK_V3", label: "FLEXO_TYVEK_V3 (Tear-resistant Tyvek)" },
                  { value: "JACQ_WOVEN_V1", label: "JACQ_WOVEN_V1 (Standard Damask)" },
                  { value: "JACQ_TAFFETA_V2", label: "JACQ_TAFFETA_V2 (High-density Taffeta)" },
                  { value: "POST_GENERIC_V1", label: "POST_GENERIC_V1 (Standard Cutting & Folding)" }
                ]}
                placeholder="Search Specification..."
                className="h-9 text-xs font-mono bg-white dark:bg-zinc-950 border-blue-200 dark:border-blue-900"
                popoverClassName="w-auto min-w-[320px]"
              />
              {errors.recipe && <span className="text-[11px] text-destructive block mt-1">{errors.recipe.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Site (Building) <span className="text-destructive">*</span></label>
              <Select value={watchSite} onValueChange={(val: any) => val && setValue("site", val, { shouldValidate: true })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Building 1">Building 1 (HQ)</SelectItem>
                  <SelectItem value="Building 2">Building 2 (Annex)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("deadline")} <span className="text-destructive">*</span></label>
              <DatePicker
                value={watchDeadline}
                onChange={(val) => setValue("deadline", val, { shouldValidate: true })}
                className="h-8 text-xs bg-white dark:bg-zinc-950"
              />
              {errors.deadline && <span className="text-[11px] text-destructive">{errors.deadline.message}</span>}
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium">{t("priority")} <span className="text-destructive">*</span></label>
              <Select value={watchPriority} onValueChange={(val: any) => val && setValue("priority", val)}>
                <SelectTrigger className="h-8 text-xs w-[50%]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {errors.priority && <span className="text-[11px] text-destructive">{errors.priority.message}</span>}
            </div>

            {/* Order Photo Field */}
            <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Order Photo / Sample Mockup</span>
                </label>
                <span className="text-[10px] text-muted-foreground">Product reference for operators</span>
              </div>

              {!orderPhotoPreview ? (
                <div 
                  className="border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-md p-3.5 flex items-center justify-center gap-3 cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all text-center"
                  onClick={() => document.getElementById('order-photo-input')?.click()}
                >
                  <input 
                    type="file" 
                    id="order-photo-input" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setOrderPhoto(file);
                        setOrderPhotoPreview(URL.createObjectURL(file));
                      }
                    }} 
                  />
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground">Click to upload product sample photo</p>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP (Mockup or approved print proof)</p>
                  </div>
                </div>
              ) : (
                <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-md p-2.5 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
                  <div className="w-14 h-14 rounded overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black/5 shrink-0 relative">
                    <img 
                      src={orderPhotoPreview} 
                      alt="Order Sample" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate">{orderPhoto?.name || "Order_Sample.jpg"}</span>
                      <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
                        Sample Attached
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {orderPhoto ? `${(orderPhoto.size / 1024 / 1024).toFixed(2)} MB` : "Photo loaded"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 rounded cursor-pointer"
                        onClick={() => document.getElementById('order-photo-input')?.click()}
                      >
                        Change Photo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                        onClick={() => {
                          setOrderPhoto(null);
                          setOrderPhotoPreview(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                    <input 
                      type="file" 
                      id="order-photo-input" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setOrderPhoto(file);
                          setOrderPhotoPreview(URL.createObjectURL(file));
                        }
                      }} 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* File Attachments (Placed Vertically) */}
            <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border/60">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attachments (Design files, proofs, PO)</span>
              </label>
              
              <div 
                className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-md p-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                onClick={() => document.getElementById('order-file-upload')?.click()}
              >
                <input 
                  type="file" 
                  id="order-file-upload" 
                  className="hidden" 
                  multiple 
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }} 
                />
                <UploadCloud className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">PDF, AI, CDR, ZIP (max 50MB)</p>
              </div>

              {/* Vertical Stack of Attached Files */}
              {attachments.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {attachments.map((file, idx) => (
                    <Attachment 
                      key={idx} 
                      size="sm" 
                      className="w-full flex items-center justify-between p-2 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors shadow-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <AttachmentMedia variant={file.type.startsWith('image/') ? 'image' : 'icon'} className="w-7 h-7 rounded shrink-0">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt={file.name} className="object-cover w-full h-full" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </AttachmentMedia>
                        <AttachmentContent className="min-w-0 flex-1">
                          <AttachmentTitle className="text-xs font-medium truncate block">{file.name}</AttachmentTitle>
                          <AttachmentDescription className="text-[10px] text-muted-foreground block">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "Document"}
                          </AttachmentDescription>
                        </AttachmentContent>
                      </div>
                      <AttachmentActions className="shrink-0 ml-2">
                        <AttachmentAction 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachments(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 mt-4 text-xs">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-600" /> Bill of Materials Preview
                </span>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 shadow-none font-mono">
                  {watchRecipe}
                </Badge>
              </div>
              <div className="text-zinc-500 mb-3">
                Material requirements are automatically loaded from the selected Master Specification.
              </div>
              
              {watchRecipe && RECIPE_MATERIALS[watchRecipe] && (
                <div className="mt-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-zinc-500">Material</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-zinc-500">Required</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-zinc-500">In Stock</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-zinc-500 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {RECIPE_MATERIALS[watchRecipe].map((mat, i) => {
                        const isShortage = mat.req > mat.stock;
                        return (
                          <TableRow 
                            key={i} 
                            className={cn(
                              "border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-muted/40",
                              isShortage && "bg-red-50/50 dark:bg-red-950/20"
                            )}
                          >
                            <TableCell className="p-2 px-2.5 font-medium text-zinc-900 dark:text-zinc-100">{mat.name}</TableCell>
                            <TableCell className="p-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">{mat.req.toLocaleString()} {mat.unit}</TableCell>
                            <TableCell className="p-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">{mat.stock.toLocaleString()} {mat.unit}</TableCell>
                            <TableCell className="p-2 px-2.5 text-right">
                              {isShortage ? (
                                <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 rounded-sm text-[9px] px-1 py-0 shadow-none font-medium">Shortage</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 rounded-sm text-[9px] px-1 py-0 shadow-none font-medium">Available</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
          </div>
          </div>

          <SheetFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/20 flex flex-row items-center justify-end gap-2 mt-auto">
            <Button type="button" variant="outline" onClick={() => setCreateOrderOpen(false)} className="h-8 text-xs">
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-8 text-xs">
              {t("submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
