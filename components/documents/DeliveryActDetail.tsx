"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useTranslations } from "next-intl";
import {
  useWorkspaceStore,
  DocumentTab,
  DeliveryActRecord,
  DeliveryActItem,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WAREHOUSE_LOCATIONS,
  DEFAULT_CARRIERS,
  CarrierProfile,
  CarrierCombobox,
  CarrierDialog,
} from "./WarehouseShipmentDetail";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Printer,
  Save,
  Check,
  Plus,
  Trash2,
  Truck,
  Scale,
  ExternalLink,
  Building2,
  FileCheck2,
  ArrowRight,
  Lock,
  AlertCircle,
  Tag,
  Sparkles,
  Layers,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function DeliveryActDetail({ tab }: { tab: DocumentTab }) {
  const t = useTranslations("DeliveryAct");
  const {
    deliveryActs,
    warehouseShipments,
    clientSettlements,
    upsertDeliveryAct,
    saveDeliveryActAsync,
    postDeliveryAct,
    replaceTabId,
    setTabUnsaved,
    setLevel3Tab,
    openTab,
    setActiveModule,
    setModule,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";
  const activeTab = tab.activeLevel3Tab || "overview";

  // Find record from store or fallback to tab.documentData
  const storeRecord = useMemo(
    () => deliveryActs.find((a) => a.id === tab.id),
    [deliveryActs, tab.id]
  );

  const initialRecord: DeliveryActRecord = useMemo(() => {
    if (storeRecord) return storeRecord;
    const d = tab.documentData || {};
    const qty = Number(d.quantity) || 1000;
    const total = Number(d.totalAmount || d.priceTotal) || 2800;
    const vatRate = 12;
    const subtotal = Number((total / (1 + vatRate / 100)).toFixed(2));
    const vatAmount = Number((total - subtotal).toFixed(2));
    return {
      id: d.id || d.docNo || tab.id,
      date: d.date || new Date().toISOString().split("T")[0],
      orderId: d.orderId || "CO-00041",
      workOrderId: d.workOrderId || "WOOF-26-0351",
      contractNo: d.contractNo || "CON-2026-101",
      customer: d.customer || "Alpha Media Group LLC",
      customerTin: d.customerTin || "305841920",
      product: d.product || "A4 Hardcover Catalog 96p",
      quantity: qty,
      unit: d.unit || "pcs",
      subtotal,
      vatRate,
      vatAmount,
      totalAmount: total,
      currency: d.currency || "USD",
      warehouse: d.warehouse || "Main Factory — Tashkent",
      carrier: d.carrier || "PrintGoo Fleet #1",
      driverName: d.driverName || "R. Ismoilov (01 A 772 BB)",
      recipientName: d.recipientName || "J. Rahimov (Ombor mudiri)",
      status: d.status || "Draft",
      linkedShipmentId: d.linkedShipmentId,
      notes: d.notes || "",
      items: d.items || [
        {
          id: "item-1",
          sku: "PRN-CAT-01",
          name: d.product || "A4 Hardcover Catalog 96p",
          unit: d.unit || "pcs",
          quantity: qty,
          unitPrice: Number((subtotal / Math.max(qty, 1)).toFixed(4)),
          vatRate: 12,
        },
      ],
    };
  }, [storeRecord, tab.documentData, tab.id]);

  const [form, setForm] = useState<DeliveryActRecord>(initialRecord);
  const [carriers, setCarriers] = useState<CarrierProfile[]>(DEFAULT_CARRIERS);
  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);

  // Sync when store record updates (e.g. after posting)
  React.useEffect(() => {
    if (storeRecord) {
      setForm(storeRecord);
    }
  }, [storeRecord]);

  const isPosted = form.status === "Signed & Stamped";

  const handleSelectCarrier = useCallback(
    (profile: CarrierProfile) => {
      if (isPosted) return;
      setForm((prev) => ({
        ...prev,
        carrier: profile.name,
        driverName:
          profile.vehicleNo && profile.vehicleNo !== "—"
            ? `${profile.driverName} (${profile.vehicleNo})`
            : profile.driverName,
      }));
      setTabUnsaved(tab.id, true);
    },
    [isPosted, setTabUnsaved, tab.id]
  );

  const handleAddNewCarrier = useCallback(
    (newProfile: CarrierProfile) => {
      setCarriers((prev) => [newProfile, ...prev]);
      handleSelectCarrier(newProfile);
    },
    [handleSelectCarrier]
  );

  // Recalculate totals from line items
  const totals = useMemo(() => {
    let sub = 0;
    let vat = 0;
    let totalQty = 0;
    form.items.forEach((item) => {
      const lineSub = item.quantity * item.unitPrice;
      const lineVat = lineSub * (item.vatRate / 100);
      sub += lineSub;
      vat += lineVat;
      totalQty += item.quantity;
    });
    return {
      subtotal: Number(sub.toFixed(2)),
      vatAmount: Number(vat.toFixed(2)),
      totalAmount: Number((sub + vat).toFixed(2)),
      totalQty,
    };
  }, [form.items]);

  const handleFieldChange = (field: keyof DeliveryActRecord, val: any) => {
    if (isPosted) return;
    setForm((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  // Client Settlement lookup
  const clientSettlement = useMemo(() => {
    return clientSettlements.find(
      (c) =>
        c.customer.toLowerCase() === form.customer.toLowerCase() ||
        c.customer.toLowerCase().includes(form.customer.toLowerCase()) ||
        form.customer.toLowerCase().includes(c.customer.toLowerCase())
    );
  }, [clientSettlements, form.customer]);

  const linkedShipment = useMemo(() => {
    return warehouseShipments.find(
      (s) => s.id === form.linkedShipmentId || s.deliveryActId === form.id
    );
  }, [warehouseShipments, form.linkedShipmentId, form.id]);

  const balanceBeforeThisAct = useMemo(() => {
    if (!clientSettlement) return 0;
    const alreadyInLedger = clientSettlement.ledger.some((l) => l.docNo === form.id);
    return alreadyInLedger
      ? Number((clientSettlement.closingBalance - totals.totalAmount).toFixed(2))
      : clientSettlement.closingBalance;
  }, [clientSettlement, form.id, totals.totalAmount]);

  const projectedBalance = useMemo(() => {
    return Number((balanceBeforeThisAct + totals.totalAmount).toFixed(2));
  }, [balanceBeforeThisAct, totals.totalAmount]);

  // Glide Data Grid for Line Items
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const itemColumns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: t("colSku"), width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: t("colName"), width: 270, icon: GridColumnIcon.HeaderString },
      { id: "size", title: "O'lcham (Razmer)", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      { id: "unit", title: t("colUnit"), width: 75, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: t("colQty"), width: 100, icon: GridColumnIcon.HeaderNumber },
      { id: "unitPrice", title: t("colPrice"), width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "subtotal", title: t("colSubtotal"), width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "vatRate", title: t("colVatRate"), width: 80, icon: GridColumnIcon.HeaderNumber },
      { id: "vatAmount", title: t("colVatAmount"), width: 115, icon: GridColumnIcon.HeaderNumber },
      { id: "total", title: t("colTotal"), width: 130, icon: GridColumnIcon.HeaderNumber },
    ],
    [t]
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = form.items[row];
      const column = itemColumns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const lineSub = Number((item.quantity * item.unitPrice).toFixed(2));
      const lineVat = Number((lineSub * (item.vatRate / 100)).toFixed(2));
      const lineTotal = Number((lineSub + lineVat).toFixed(2));

      if (column.id === "sku" || column.id === "name" || column.id === "unit") {
        const val = String(item[column.id as keyof DeliveryActItem] || "");
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: !isPosted,
          readonly: isPosted,
        };
      }

      if (column.id === "size") {
        const val = String(item.size || "Universal");
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: !isPosted,
          readonly: isPosted,
          themeOverride: {
            baseFontStyle: "bold 11px monospace",
            textDark: isDark ? "#38bdf8" : "#0284c7",
          },
        };
      }

      if (column.id === "quantity" || column.id === "unitPrice" || column.id === "vatRate") {
        const numVal = Number(item[column.id as keyof DeliveryActItem] || 0);
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData:
            column.id === "unitPrice"
              ? numVal.toFixed(2)
              : column.id === "vatRate"
              ? `${numVal}%`
              : numVal.toLocaleString(),
          allowOverlay: !isPosted,
          readonly: isPosted,
          contentAlign: "right",
        };
      }

      const calcVal =
        column.id === "subtotal"
          ? lineSub
          : column.id === "vatAmount"
          ? lineVat
          : lineTotal;

      return {
        kind: GridCellKind.Number,
        data: calcVal,
        displayData: `$${calcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        allowOverlay: false,
        readonly: true,
        contentAlign: "right",
        themeOverride:
          column.id === "total"
            ? {
                baseFontStyle: "700 12px monospace",
                textDark: isDark ? "#60a5fa" : "#1d4ed8",
              }
            : undefined,
      };
    },
    [form.items, itemColumns, isPosted, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (isPosted) return;
      const [col, row] = cell;
      const column = itemColumns[col];
      if (!column) return;

      setForm((prev) => {
        const updatedItems = [...prev.items];
        const target = { ...updatedItems[row] };
        if (!target) return prev;

        if (
          (column.id === "sku" || column.id === "name" || column.id === "unit" || column.id === "size") &&
          newValue.kind === GridCellKind.Text
        ) {
          (target as any)[column.id] = newValue.data;
        } else if (
          (column.id === "quantity" || column.id === "unitPrice" || column.id === "vatRate") &&
          newValue.kind === GridCellKind.Number
        ) {
          (target as any)[column.id] = Number(newValue.data) || 0;
        }

        updatedItems[row] = target;
        return {
          ...prev,
          product: updatedItems[0]?.name || prev.product,
          quantity: updatedItems.reduce((s, i) => s + i.quantity, 0),
          items: updatedItems,
        };
      });
      setTabUnsaved(tab.id, true);
    },
    [isPosted, itemColumns, setTabUnsaved, tab.id]
  );

  const handleAddRow = () => {
    if (isPosted) return;
    const newItem: DeliveryActItem = {
      id: `item-${Date.now()}`,
      sku: `PRN-0${form.items.length + 1}`,
      name: form.product || "Qo'shimcha tekstil mahsuloti",
      size: "Universal",
      unit: form.unit || "pcs",
      quantity: 1000,
      unitPrice: 0.5,
      vatRate: 12,
    };
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setTabUnsaved(tab.id, true);
  };

  const handlePopulateTextileSizes = (preset: "standard" | "extended" | "kids" = "standard") => {
    if (isPosted) return;
    const baseName = form.product || form.items[0]?.name || "Tekstil yorlig'i / Buyurtma";
    const baseSku = form.items[0]?.sku || "TXT-01";
    const basePrice = form.items[0]?.unitPrice || 0.45;

    let targetSizes: string[];
    if (preset === "kids") {
      targetSizes = ["98-104", "110-116", "122-128", "134-140", "146-152"];
    } else if (preset === "extended") {
      targetSizes = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
    } else {
      targetSizes = ["XS", "S", "M", "L", "XL", "XXL"];
    }

    const cleanBaseName = baseName.replace(/\s*\([^)]*\)$/, "");
    const cleanBaseSku = baseSku.replace(/-[A-Z0-9]+$/, "");

    const newItems: DeliveryActItem[] = targetSizes.map((sz, i) => ({
      id: `item-sz-${Date.now()}-${i}`,
      sku: `${cleanBaseSku}-${sz}`,
      name: `${cleanBaseName} (${sz})`,
      size: sz,
      unit: form.unit || "pcs",
      quantity: 1000,
      unitPrice: basePrice,
      vatRate: 12,
    }));

    setForm((prev) => {
      const isSingleUniversal =
        prev.items.length <= 1 &&
        (!prev.items[0]?.size || prev.items[0]?.size === "Universal");
      const updated = isSingleUniversal ? newItems : [...prev.items, ...newItems];
      return {
        ...prev,
        product: cleanBaseName,
        quantity: updated.reduce((s, i) => s + i.quantity, 0),
        items: updated,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const sizeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    form.items.forEach((item) => {
      const s = (item.size || "Universal").trim();
      counts[s] = (counts[s] || 0) + (item.quantity || 0);
    });
    return counts;
  }, [form.items]);

  const handleDeleteSelectedRow = () => {
    if (isPosted) return;
    const rows = selection.rows.toArray();
    if (rows.length === 0 || form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => !rows.includes(idx)),
    }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  const isDraft = !form.id || form.id.startsWith("draft-") || form.id.startsWith("new-") || form.id === "NEW";

  const handleSave = () => {
    let finalId = form.id;
    if (isDraft) {
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      let maxSf = 0;
      for (const a of deliveryActs) {
        const m = a.id?.match(new RegExp(`^SF-${yearSuffix}-(\\d+)$`, "i"));
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSf) maxSf = n;
        }
      }
      finalId = `SF-${yearSuffix}-${String(maxSf + 1).padStart(4, "0")}`;
    }
    const updated: DeliveryActRecord = {
      ...form,
      id: finalId,
      quantity: totals.totalQty,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
    };
    upsertDeliveryAct(updated);
    if (saveDeliveryActAsync) {
      saveDeliveryActAsync(updated);
    }
    if (isDraft) {
      replaceTabId(tab.id, finalId, `${finalId}: ${updated.customer || "Dalolatnoma"}`, updated);
      setForm(updated);
    }
    setTabUnsaved(tab.id, false);
  };

  const handlePostAct = () => {
    const updated: DeliveryActRecord = {
      ...form,
      quantity: totals.totalQty,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
    };
    upsertDeliveryAct(updated);
    postDeliveryAct(updated.id);
    if (saveDeliveryActAsync) {
      saveDeliveryActAsync({ ...updated, status: "Signed & Stamped" });
    }
    setTabUnsaved(tab.id, false);
  };

  const handleNavigateToOrder = () => {
    if (!form.orderId) return;
    openTab({
      id: form.orderId,
      title: `${form.orderId}: ${form.customer}`,
      type: "work-order",
      module: "production",
      documentData: {
        docNo: form.orderId,
        customer: form.customer,
        product: form.product,
        quantity: form.quantity,
        unit: form.unit,
        linkedWoId: form.workOrderId,
      },
    });
  };

  const handleNavigateToWorkOrder = () => {
    if (!form.workOrderId) return;
    openTab({
      id: form.workOrderId,
      title: `${form.workOrderId}: ${form.product}`,
      type: "work-order",
      module: "production",
      documentData: {
        docNo: form.workOrderId,
        customer: form.customer,
        product: form.product,
        quantity: form.quantity,
        unit: form.unit,
        linkedOrderId: form.orderId,
      },
    });
  };

  const handleJumpToWarehouseShipments = () => {
    setActiveModule("warehouse");
    setModule("warehouse", "shipments");
    openTab({
      id: "tab-warehouse-shipments",
      title: "Shipments",
      type: "registry",
      module: "warehouse",
    });
  };

  const handleJumpToFinanceSettlements = () => {
    setActiveModule("finance");
    setModule("finance", "settlements");
    openTab({
      id: "tab-finance-settlements",
      title: "Client Settlements (Akt sverka)",
      type: "registry",
      module: "finance",
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Level 3 Header Bar */}
        <div className="px-3 bg-muted/60 border-b border-border shrink-0 flex items-center justify-between h-9 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TabsList variant="line" className="gap-1 overflow-x-auto overflow-y-hidden no-scrollbar min-w-0">
              <TabsTrigger value="overview" className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0">
                <FileText className="w-3.5 h-3.5" />
                <span>{t("tabOverview")}</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0">
                <Printer className="w-3.5 h-3.5" />
                <span>{t("tabPreview")}</span>
              </TabsTrigger>
              <TabsTrigger value="links" className="h-8 text-xs px-2.5 font-medium gap-1.5 shrink-0">
                <Scale className="w-3.5 h-3.5" />
                <span>{t("tabLinks")}</span>
              </TabsTrigger>
            </TabsList>

            <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

            {isPosted ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px] gap-1 font-medium shrink-0">
                <Lock className="w-3 h-3" />
                <span>{t("postedBadge")}</span>
              </Badge>
            ) : form.status === "Pending Signature" ? (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[11px] font-medium shrink-0">
                {t("pendingBadge")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] font-medium shrink-0">
                {t("draftBadge")}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => {
                      setLevel3Tab(tab.id, "preview");
                      if (typeof window !== "undefined") {
                        setTimeout(() => window.print(), 150);
                      }
                    }}
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                {t("print")}
              </TooltipContent>
            </Tooltip>

            {!isPosted && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={handleSave}
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                  {t("save")} (Ctrl+S)
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              onClick={handlePostAct}
              disabled={isPosted}
              size="sm"
              className="h-7 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs gap-1.5 shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isPosted ? t("postedBadge") : t("postAct")}</span>
            </Button>
          </div>
        </div>

        {/* ── TAB 1: OVERVIEW & LINE ITEMS ─────────────────────────────────── */}
        <TabsContent
          value="overview"
          className="flex-1 overflow-y-auto p-3 m-0 space-y-3"
        >
          {/* Top 3-column grid: Requisites | Logistics | Financial Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Card 1: Document Requisites */}
            <div className="bg-card border border-border rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>{t("requisitesTitle")}</span>
                </div>
                <span className={cn("font-mono text-[11px] font-semibold text-primary", isDraft && "text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded")}>
                  {isDraft ? "Yangi (Avtomatik)" : form.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("docNo")}</Label>
                  <Input
                    value={isDraft ? "Yangi (Avtomatik)" : form.id}
                    readOnly
                    className="h-7 text-xs font-mono bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("date")}</Label>
                  <DatePicker
                    value={form.date}
                    disabled={isPosted}
                    onChange={(val) => handleFieldChange("date", val)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-[11px] text-muted-foreground">{t("customer")}</Label>
                  <Input
                    value={form.customer}
                    readOnly={isPosted}
                    onChange={(e) => handleFieldChange("customer", e.target.value)}
                    className="h-7 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("customerTin")}</Label>
                  <Input
                    value={form.customerTin}
                    readOnly={isPosted}
                    onChange={(e) => handleFieldChange("customerTin", e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("contractNo")}</Label>
                  <Input
                    value={form.contractNo}
                    readOnly={isPosted}
                    onChange={(e) => handleFieldChange("contractNo", e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Ish buyurtmasi / Work Order (WO) *</span>
                    {form.workOrderId && (
                      <span className="text-[10px] text-primary font-mono font-medium">
                        Texnologik xarita biriktirilgan
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={form.workOrderId}
                      readOnly={isPosted}
                      onChange={(e) => handleFieldChange("workOrderId", e.target.value)}
                      placeholder="Masalan: WOOF-26-0351"
                      className="h-7 text-xs font-mono font-semibold"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNavigateToWorkOrder}
                      className="h-7 px-2.5 text-xs gap-1.5 shrink-0 cursor-pointer"
                      title="Ish buyurtmasiga o'tish (WO)"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">WO ochish</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Warehouse Dispatch & Logistics */}
            <div className="bg-card border border-border rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{t("logisticsTitle")}</span>
                </div>
                {linkedShipment ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 font-mono text-[10px]">
                    {linkedShipment.id} ({linkedShipment.status})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Ombor kutilmoqda
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("warehouse")}</Label>
                  <Select
                    value={form.warehouse}
                    disabled={isPosted}
                    onValueChange={(val) => handleFieldChange("warehouse", val)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue placeholder="Chiqim omborini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WAREHOUSE_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs">
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>{t("carrier")} & Transport</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Bitta tanlov (Combobox)</span>
                  </Label>
                  <CarrierCombobox
                    carrier={form.carrier}
                    driverName={form.driverName}
                    carriers={carriers}
                    onSelect={handleSelectCarrier}
                    onAddNew={() => setCarrierDialogOpen(true)}
                    disabled={isPosted}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("recipient")}</Label>
                  <Input
                    value={form.recipientName}
                    readOnly={isPosted}
                    onChange={(e) => handleFieldChange("recipientName", e.target.value)}
                    placeholder="Masalan: Vakil (Ishonchnoma asosida)"
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Settlement & Accounting Impact (Keyingi hisob-kitoblar) */}
            <div className="bg-card border border-border rounded-md p-3 flex flex-col justify-between space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t("settlementSummary")}</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {form.currency}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("currentBalance")}:</span>
                    <span className="font-mono font-medium">
                      ${balanceBeforeThisAct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("invoiceAmount")}:</span>
                    <span className="font-mono font-semibold text-primary">
                      +${totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="font-semibold text-foreground">{t("projectedBalance")}:</span>
                    <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                      ${projectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleJumpToFinanceSettlements}
                  className="h-7 text-xs flex-1 gap-1"
                >
                  <Scale className="w-3.5 h-3.5 text-rose-600" />
                  <span>{t("openSettlements")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleJumpToWarehouseShipments}
                  className="h-7 text-xs flex-1 gap-1"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t("openShipment")}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Line Items Grid (Glide Data Grid) */}
          <div className="bg-card border border-border rounded-md flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-foreground">{t("itemsTitle")}</span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {form.items.length} pozitsiya • {totals.totalQty.toLocaleString()} {form.unit}
                </Badge>
              </div>

              {!isPosted && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePopulateTextileSizes("standard")}
                    className="h-7 px-2.5 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                    title="Tekstil o'lchamlarini (XS, S, M, L, XL, XXL) avtomatik to'ldirish"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Tekstil o&apos;lchamlari (XS-XXL)</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="h-7 px-2 text-xs gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("addRow")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteSelectedRow}
                    disabled={selection.rows.length === 0 || form.items.length <= 1}
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Textile Size Breakdown Ribbon */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-muted/20 border-b border-border text-xs">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Tag className="w-3 h-3 text-primary" />
                <span>O&apos;lchamlar taqsimoti (Tekstil matrisi):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.entries(sizeBreakdown).map(([sz, qty]) => (
                  <Badge
                    key={sz}
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 py-0 font-mono bg-background border-border gap-1"
                  >
                    <span className="font-bold text-primary">{sz}:</span>
                    <span>{qty.toLocaleString()} {form.unit}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="w-full h-[340px] relative">
              <DataEditor
                getCellContent={getCellContent}
                onCellEdited={handleCellEdited}
                columns={itemColumns}
                rows={form.items.length}
                rowMarkers="both"
                freezeColumns={1}
                width="100%"
                height={340}
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                headerHeight={28}
                rowHeight={28}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              />
            </div>

            {/* Footer Totals Bar */}
            <div className="px-3 py-2 bg-muted/40 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <div className="text-[11px] text-muted-foreground">
                {form.notes || "Izoh: Mahsulot to'liq hajmda va sifat nazorati (OTK) tasdig'i bilan topshirildi."}
              </div>
              <div className="flex items-center gap-5 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground mr-1.5">{t("colSubtotal")}:</span>
                  <span className="font-semibold">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1.5">{t("colVatAmount")} (12%):</span>
                  <span className="font-semibold">${totals.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground mr-1.5 font-sans font-semibold">{t("colTotal")}:</span>
                  <span className="font-bold text-primary">
                    ${totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {form.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: OFFICIAL PRINT PREVIEW (HISOBVARAQ-FAKTURA) ─────────── */}
        <TabsContent
          value="preview"
          className="flex-1 overflow-y-auto p-4 m-0 flex justify-center bg-muted/30"
        >
          <div className="w-full max-w-[860px] bg-card text-foreground border border-border rounded-md shadow-xs p-6 space-y-5 font-sans">
            {/* Document Header */}
            <div className="text-center space-y-1 border-b border-border pb-4">
              <div className="text-sm font-bold tracking-wide uppercase">
                {t("officialTitle")}
              </div>
              <div className="font-mono text-xs font-semibold">
                № {isDraft ? "Yangi (Avtomatik)" : form.id} • {form.date} yil
              </div>
              <div className="text-[11px] text-muted-foreground">
                Shartnoma: {form.contractNo} | Ish buyurtmasi (WO): {form.workOrderId}
              </div>
            </div>

            {/* Supplier & Buyer 2-Column Requisites */}
            <div className="grid grid-cols-2 gap-6 text-xs border-b border-border pb-4">
              <div className="space-y-1">
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                  {t("supplierLabel")}
                </div>
                <div className="font-bold text-sm">“PRINTGOO INDUSTRIAL POLYGRAPH” MChJ</div>
                <div>Manzil: Toshkent sh., Amir Temur ko'chasi, 12-uy</div>
                <div className="font-mono">STIR (INN): 301224890 • QQS kodi: 326010019281</div>
                <div className="font-mono">H/R: 20208000900451120001 • MFO: 00401</div>
                <div>Chiqim ombori: {form.warehouse}</div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                  {t("buyerLabel")}
                </div>
                <div className="font-bold text-sm">{form.customer}</div>
                <div className="font-mono">STIR (INN): {form.customerTin}</div>
                <div>Shartnoma №: {form.contractNo}</div>
                <div>Yetkazib berish: {form.carrier} ({form.driverName})</div>
                <div>Qabul qiluvchi: {form.recipientName}</div>
              </div>
            </div>

            {/* Specification Grid (Div-based layout for print preview) */}
            <div className="border border-border rounded overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/70 border-b border-border font-semibold text-[11px] py-1.5 px-2">
                <div className="col-span-1">№</div>
                <div className="col-span-3">{t("colName")}</div>
                <div className="col-span-1 text-center">O&apos;lcham</div>
                <div className="col-span-1 text-center">{t("colUnit")}</div>
                <div className="col-span-1 text-right">{t("colQty")}</div>
                <div className="col-span-1 text-right">{t("colPrice")}</div>
                <div className="col-span-2 text-right">{t("colSubtotal")}</div>
                <div className="col-span-1 text-right">QQS 12%</div>
                <div className="col-span-1 text-right">{t("colTotal")}</div>
              </div>

              {form.items.map((item, idx) => {
                const sub = item.quantity * item.unitPrice;
                const vat = sub * (item.vatRate / 100);
                const tot = sub + vat;
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 border-b border-border last:border-b-0 py-2 px-2 text-xs items-center"
                  >
                    <div className="col-span-1 font-mono text-muted-foreground">{idx + 1}</div>
                    <div className="col-span-3 font-medium">
                      <div>{item.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{item.sku}</div>
                    </div>
                    <div className="col-span-1 text-center font-mono font-bold text-primary">
                      {item.size || "Universal"}
                    </div>
                    <div className="col-span-1 text-center">{item.unit}</div>
                    <div className="col-span-1 text-right font-mono">{item.quantity.toLocaleString()}</div>
                    <div className="col-span-1 text-right font-mono">${item.unitPrice.toFixed(2)}</div>
                    <div className="col-span-2 text-right font-mono">${sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-1 text-right font-mono">${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-1 text-right font-mono font-semibold">${tot.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                );
              })}

              {/* Summary Row */}
              <div className="grid grid-cols-12 bg-muted/50 border-t border-border py-2 px-2 text-xs font-bold">
                <div className="col-span-6">JAMI TO'LOVGA ({form.currency}):</div>
                <div className="col-span-1 text-right font-mono">{totals.totalQty.toLocaleString()}</div>
                <div className="col-span-1" />
                <div className="col-span-2 text-right font-mono">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="col-span-1 text-right font-mono">${totals.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="col-span-1 text-right font-mono text-primary">${totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* Signatures & Stamp Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
              <div className="space-y-6 border border-dashed border-border rounded p-3">
                <div className="font-semibold">{t("releasedBy")}:</div>
                <div className="flex items-center justify-between text-muted-foreground pt-2">
                  <span>Imzo: _______________________</span>
                  <span className="font-mono">M.O'. (Muhr)</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Ombor yuk xati №: <span className="font-mono font-semibold text-foreground">{linkedShipment?.id || "Tasdiqlangach beriladi"}</span>
                </div>
              </div>

              <div className="space-y-6 border border-dashed border-border rounded p-3">
                <div className="font-semibold">{t("receivedBy")}:</div>
                <div className="flex items-center justify-between text-muted-foreground pt-2">
                  <span>Imzo: _______________________</span>
                  <span>{form.recipientName}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Sana: <span className="font-mono text-foreground">{form.date}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: WAREHOUSE & FINANCE MOVEMENTS (1C ДВИЖЕНИЯ ДОКУМЕНТА) ── */}
        <TabsContent
          value="links"
          className="flex-1 overflow-y-auto p-3 m-0 space-y-3"
        >
          {!isPosted && (
            <div className="bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-md p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t("notPostedHint")}</span>
              </div>
              <Button
                size="sm"
                onClick={handlePostAct}
                className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t("postAct")}</span>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Warehouse Movement Card */}
            <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>{t("warehouseMovementTitle")}</span>
                </div>
                {linkedShipment ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 font-mono">
                    {linkedShipment.id} • {linkedShipment.status}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Hali shakllanmagan</Badge>
                )}
              </div>

              <div className="bg-muted/40 rounded p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ombor hujjati:</span>
                  <span className="font-mono font-semibold">{linkedShipment?.id || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chiqim ombori:</span>
                  <span>{form.warehouse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mahsulot va miqdor (narxsiz):</span>
                  <span className="font-mono font-semibold">
                    {form.product} — {totals.totalQty.toLocaleString()} {form.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transport / Kuzatuv №:</span>
                  <span className="font-mono">{linkedShipment?.trackingNo || form.carrier}</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleJumpToWarehouseShipments}
                className="h-7 text-xs w-full gap-1.5"
              >
                <span>Warehouse &rarr; Shipments reyestrini ochish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Finance / Accounts Receivable Movement Card */}
            <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Scale className="w-4 h-4 text-rose-600" />
                  <span>{t("financeMovementTitle")}</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-mono">
                  Dt 4010 / Kt 9010
                </Badge>
              </div>

              <div className="bg-muted/40 rounded p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kontragent:</span>
                  <span className="font-medium">{form.customer} (STIR: {form.customerTin})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shartnoma:</span>
                  <span className="font-mono">{form.contractNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hisoblangan qarzdorlik (+Debet):</span>
                  <span className="font-mono font-bold text-primary">
                    +${totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {form.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mijozning joriy saldosi:</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    ${(clientSettlement?.closingBalance ?? projectedBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {form.currency}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleJumpToFinanceSettlements}
                className="h-7 text-xs w-full gap-1.5"
              >
                <span>Finance &rarr; Hisob-kitoblar (Akt sverka) ni ochish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Unified Carrier Dialog for adding/editing vehicles and drivers */}
      <CarrierDialog
        open={carrierDialogOpen}
        onOpenChange={setCarrierDialogOpen}
        onSave={handleAddNewCarrier}
      />
    </div>
  );
}
