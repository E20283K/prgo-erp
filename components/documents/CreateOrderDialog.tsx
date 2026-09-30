"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const orderSchema = z.object({
  customer: z.string().min(1, "Customer is required"),
  product: z.string().min(1, "Product description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit: z.string().min(1, "Unit is required"),
  machine: z.string().min(1, "Machine is required"),
  deadline: z.string().min(1, "Deadline is required"),
  priority: z.enum(["Normal", "High", "Urgent"]),
});

type OrderFormValues = z.infer<typeof orderSchema>;

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
      quantity: 1000,
      unit: "pcs",
      machine: "",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      priority: "Normal",
    },
  });

  const watchUnit = watch("unit");
  const watchMachine = watch("machine");
  const watchPriority = watch("priority");

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
      },
    });

    reset();
    setCreateOrderOpen(false);
  };

  return (
    <Dialog open={isCreateOrderOpen} onOpenChange={(open) => {
      if (!open) reset();
      setCreateOrderOpen(open);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("customer")} <span className="text-destructive">*</span></label>
              <Input {...register("customer")} className="h-8 text-xs" placeholder="e.g. Alpha Media Group" />
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("machine")} <span className="text-destructive">*</span></label>
              <Select value={watchMachine} onValueChange={(val: string | null) => val && setValue("machine", val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Machine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Heidelberg XL 106">Heidelberg XL 106</SelectItem>
                  <SelectItem value="Heidelberg SX 74">Heidelberg SX 74</SelectItem>
                  <SelectItem value="Komori Lithrone G40">Komori Lithrone G40</SelectItem>
                  <SelectItem value="Bobst Novacut 106">Bobst Novacut 106</SelectItem>
                </SelectContent>
              </Select>
              {errors.machine && <span className="text-[11px] text-destructive">{errors.machine.message}</span>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t("deadline")} <span className="text-destructive">*</span></label>
              <Input type="date" {...register("deadline")} className="h-8 text-xs block w-full" />
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
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setCreateOrderOpen(false)} className="h-8 text-xs">
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-8 text-xs">
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
