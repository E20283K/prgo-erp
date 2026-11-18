"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "cn";
import {
  FileText,
  Boxes,
  Factory,
  Clock,
  History,
  Printer,
  Save,
  Check,
  Receipt,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  Cpu,
  Layers,
  Ruler,
  Paperclip,
  LayoutTemplate,
  Disc,
  FlaskConical,
  Stamp,
  X,
  RotateCw,
  MoreVertical,
  BookmarkPlus,
  Loader2,
  Trash2,
  Truck,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DocumentHeader,
  HeaderIconAction,
  DocumentSidebar,
  SidebarSummaryCard,
  SidebarSectionTitle,
  InfoRow,
  formatMoney,
} from "../common/DocumentShell";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { useLookupStore } from "@/store/lookupStore";
import { useTranslations } from "next-intl";
import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid";

import {
  WorkOrderFormData,
  WorkOrderSampleData,
  SampleRevisionRecord,
  SizeDistribution,
  SkuArtwork,
  OrderAttachment,
  RouteStep,
  ShiftEvent,
  MasterSpecification,
  MASTER_SPECIFICATIONS,
  SITE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  MACHINE_OPTIONS,
  RECIPE_MATERIALS,
  MACHINE_MAP,
  getInitialOperations,
  getNextWorkOrderNo,
  type WorkOrderDepartment,
  type WorkOrderDeliveryBatch,
} from "./types";
import { EXAMPLE_ATTACHMENTS } from "@/components/file-viewer/file-utils";
import { OverviewTab, getDisplayImageUrl } from "./tabs/OverviewTab";
import { SpecificationsTab } from "./tabs/SpecificationsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { ShiftTimelineTab } from "./tabs/ShiftTimelineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { FinancialsTab } from "./tabs/FinancialsTab";
import { FilesTab } from "../common/FilesTab";
import { LayoutCalcTab } from "./tabs/LayoutCalcTab";
import { FlexoCalcTab } from "./tabs/FlexoCalcTab";
import { DieLayoutTab } from "./tabs/die-layout/DieLayoutTab";
import { ShipmentsTab } from "./tabs/ShipmentsTab";
import { getProducedOutputQty, isProductionRouteFinished } from "./utils/productionOutput";
import { DEFAULT_SHIFTS, atPlantTime, occurredAtFromTime, plantClock, type ShiftInterval } from "@/lib/shiftSchedule";
import { stepUnit } from "./utils/stepKpis";
import { getCountingProfile, planInUnit } from "./utils/countingProfile";
import { useAskDialog } from "./dialogs/AskDialog";
import { resolveMachine } from "./utils/operationCost";
import {
  applyTimelineToStep,
  formatMinutes,
  getStepTimeline,
  isOpenDowntime,
  stepGoodOutput,
} from "./utils/stepTimeline";
import { OperationDialog } from "./dialogs/OperationDialog";
import { LogEventDialog } from "./dialogs/LogEventDialog";
import { PalletReportDialog } from "./dialogs/PalletReportDialog";
import { DowntimeLogDialog } from "./dialogs/DowntimeLogDialog";
import { JobTicketDialog } from "./dialogs/JobTicketDialog";
import { PackagingDialog } from "./dialogs/PackagingDialog";
import { TelegramOrdersGroupModal } from "./TelegramOrdersGroupModal";
import { BoxLabelPrintModal } from "./dialogs/BoxLabelPrintModal";
import { SaveSpecDialog } from "./dialogs/SaveSpecDialog";
import {
  BomItem,
  normalizeBomItem,
} from "../BomMaterialsGrid";
import { WorkOrderPackagingSummary, WorkOrderToolingItem, ensurePackagingStep, kashirovkaPlatesPerForm, syncKashirovkaLayerColors, withSyncedKashirovkaColors } from "./types";
import {
  calculateWorkOrderFinancials,
  DEFAULT_OVERHEAD_PERCENT,
  getWorkOrderMaterialReturns,
  resolveEffectiveCost,
} from "./utils/financialsEngine";
import { elapsedRunMinutes } from "./utils/operationCost";
import { PrepressToolingTab } from "./tabs/PrepressToolingTab";
import { calculatePrintPlanning } from "./planningEngine";
import { WarehouseStockRecord } from "@/store/workspaceStore";
import { computeTariffEstimate, TariffRecord } from "@/components/documents/tariff/types";
import { deriveWorkOrderStatus } from "@/lib/workOrderStatus";

import { getInitialToolingItems } from "./toolingItems";
import { buildReorderDocument } from "./reorder";
export { getInitialToolingItems };

export function syncBomWithSpecs(
  bomItems: BomItem[],
  form: Partial<WorkOrderFormData>,
  stockList: WarehouseStockRecord[] = []
): BomItem[] {
  // Always sanitize and strip any legacy random mock items (e.g. MAT-LAM-8673, MAT-COAT-7971)
  let items = bomItems.filter(
    (i) =>
      !i.id.match(/^MAT-(LAM|COAT|EMB)-\d{4}$/) ||
      i.id === form.laminationStockSku ||
      i.id === form.coatingStockSku ||
      i.id === form.embellishmentStockSku
  );
  const paperName = form.paperStock?.trim();
  const targetQty = Number(form.quantity) || 0;
  const targetSheets = Number((form as any).plannedSheets) || 0;
  let requiredPaperSheets = targetSheets > 0 ? targetSheets : Math.ceil(targetQty * 1.05);

  if (paperName && targetQty > 0) {
    const ws = stockList.find(
      (s) =>
        s.name.toLowerCase() === paperName.toLowerCase() ||
        s.sku.toLowerCase() === paperName.toLowerCase()
    );

    const paperIdx = items.findIndex(
      (i) =>
        i.category === "Paper & Board" ||
        i.category === "Roll & Label" ||
        i.category === "Offcuts & Scraps"
    );

    // Roll stock (flexo/termo labels) is consumed in running metres, not one sheet per piece.
    const stockCategory = ws?.category || (paperIdx >= 0 ? items[paperIdx].category : undefined);
    const stockUnit = (ws?.unit || (paperIdx >= 0 ? items[paperIdx].unit : "") || "").toLowerCase();
    const isRollStock = stockCategory === "Roll & Label";
    const labelW = Number(form.width) || 0;
    const labelH = Number(form.height) || 0;
    const webWidth = Number(form.flexoWebWidth) || 100;
    if (isRollStock && labelW > 0 && labelH > 0) {
      const gapX = Number(form.flexoGapX ?? 3) || 0;
      const gapY = Number(form.flexoGapY ?? 3) || 0;
      const maxLanes = Math.max(1, Math.floor((webWidth + gapX) / (labelW + gapX)));
      const lanes = Math.min(maxLanes, Math.max(1, Math.floor(Number(form.flexoLanes) || 1)));
      const wastePct = Number(form.runWastePercent ?? 5) || 0;
      const meters = (Math.ceil(targetQty / lanes) * (labelH + gapY)) / 1000 * (1 + wastePct / 100);
      const isArea = stockUnit.includes("m²") || stockUnit.includes("m2") || stockUnit.includes("kv");
      const required = isArea ? (meters * webWidth) / 1000 : meters;
      requiredPaperSheets = Number(required.toFixed(2));
    }

    const sheetFormat = isRollStock
      ? `${webWidth} mm`
      : ws?.sheetFormat ||
        (form.parentSheetW && form.parentSheetH
          ? `${form.parentSheetW}×${form.parentSheetH}`
          : "700×1000");
    const grammage = ws?.grammage || (form as any).paperDensity || 150;

    // BOM unit prices are kept in the order currency (same as BomMaterialsGrid / financialsEngine).
    const orderCur = (form.currency || "UZS").toUpperCase();
    const fx = Number(form.exchangeRate) || 12850;
    let wsPrice: { unitPrice: number; originalUnitPrice: number; originalCurrency: "USD" | "UZS" } | null = null;
    if (ws) {
      const stockCur: "USD" | "UZS" =
        (ws as any).currency || ((ws as any).unitPriceUzs && !ws.unitPriceUsd ? "UZS" : "USD");
      const orig = Number(
        stockCur === "UZS"
          ? (ws as any).unitPriceUzs || (ws as any).unitPrice || 0
          : ws.unitPriceUsd || (ws as any).unitPrice || 0
      );
      if (orig > 0) {
        const converted =
          stockCur === "USD" && orderCur === "UZS"
            ? Number((orig * fx).toFixed(2))
            : stockCur === "UZS" && orderCur === "USD"
            ? Number((orig / fx).toFixed(4))
            : orig;
        wsPrice = { unitPrice: converted, originalUnitPrice: orig, originalCurrency: stockCur };
      }
    }
    const unitPrice = wsPrice
      ? wsPrice.unitPrice
      : paperIdx >= 0 && items[paperIdx].unitPrice > 0
      ? items[paperIdx].unitPrice
      : 0;
    const priceMeta = wsPrice
      ? { originalUnitPrice: wsPrice.originalUnitPrice, originalCurrency: wsPrice.originalCurrency }
      : {};
    const specText = isRollStock ? `${sheetFormat} rulon` : `${grammage} g/m², ${sheetFormat}`;

    if (paperIdx >= 0) {
      const existing = items[paperIdx];
      const planQty = requiredPaperSheets;
      const actualQty =
        existing.actualQty > 0 && existing.actualQty !== existing.planQty
          ? existing.actualQty
          : planQty;
      const totalPrice = Number((actualQty * unitPrice).toFixed(2));

      items[paperIdx] = {
        ...existing,
        name: paperName,
        spec: specText,
        category: ws?.category || existing.category,
        sheetFormat,
        grammage,
        ...(isRollStock ? { rollWidthMm: webWidth } : {}),
        planQty,
        actualQty,
        qty: actualQty,
        unit: ws?.unit || existing.unit || "Sheets",
        unitPrice,
        ...priceMeta,
        totalPrice,
        supplier: existing.supplier || "Ombor",
        availability: ws?.status === "Critical" ? "Low Stock" : (ws?.status || existing.availability || "In Stock"),
        warehouseLocation: ws?.location || existing.warehouseLocation || "SHELF-A1",
        warehouseStockLevel: ws?.stockLevel ?? existing.warehouseStockLevel,
        warehouseAvailable: ws?.available ?? existing.warehouseAvailable,
      };
    } else {
      const wsImg =
        ws?.imageUrl &&
        typeof ws.imageUrl === "string" &&
        !ws.imageUrl.startsWith("data:image/svg+xml")
          ? ws.imageUrl.trim()
          : undefined;

      const newPaper: BomItem = {
        id: ws?.sku || `MAT-PAP-${Date.now().toString().slice(-4)}`,
        name: paperName,
        spec: specText,
        category: ws?.category || "Paper & Board",
        sheetFormat,
        grammage,
        ...(isRollStock ? { rollWidthMm: webWidth } : {}),
        planQty: requiredPaperSheets,
        actualQty: requiredPaperSheets,
        wasteQty: 0,
        qty: requiredPaperSheets,
        unit: ws?.unit || "Sheets",
        unitPrice,
        ...priceMeta,
        totalPrice: Number((requiredPaperSheets * unitPrice).toFixed(2)),
        supplier: ws?.supplier || "Ombor",
        availability: ws?.status === "Critical" ? "Low Stock" : (ws?.status || "In Stock"),
        issueType: "standard",
        faultParty: "none",
        warehouseLocation: ws?.location || "SHELF-A1",
        warehouseStockLevel: ws?.stockLevel,
        warehouseAvailable: ws?.available,
        sourceType: "warehouse",
        imageUrl: wsImg,
      };
      items = [newPaper, ...items];
    }
  }

  // 2. Lamination sync (Only sync to BOM when a real warehouse stock item is selected)
  const lam = form.lamination;
  const isLamActive = Boolean(
    lam && lam !== "none" && lam !== "None / Uncoated" && lam !== "None"
  );

  if (!isLamActive || !form.laminationStockSku) {
    items = items.filter(
      (i) =>
        !i.id.startsWith("MAT-LAM") &&
        !(i.category === "Foil & Film" && (i.name.toLowerCase().includes("film") || i.name.toLowerCase().includes("laminat")))
    );
  } else if (targetQty > 0) {
    const wsLam = stockList.find((s) => s.sku === form.laminationStockSku);
    if (!wsLam) {
      items = items.filter(
        (i) =>
          !i.id.startsWith("MAT-LAM") &&
          !(i.category === "Foil & Film" && (i.name.toLowerCase().includes("film") || i.name.toLowerCase().includes("laminat")))
      );
    } else {
      // Remove any legacy mock lamination items
      items = items.filter((i) => !i.id.startsWith("MAT-LAM") || i.id === wsLam.sku);
      const lamMeter = Math.ceil(
        requiredPaperSheets * (Number(form.laminationSides === "2s" ? 2 : 1) * 0.72)
      );
      const lamName = wsLam.name || (form.laminationStockName || `${lam} Film`);
      const lamSpec = wsLam.sheetFormat || `BOPP ${form.laminationMicron || 24}µm, ${form.laminationSides || "1s"}`;
      const lamPrice = wsLam.unitPriceUsd
        ? Number(wsLam.unitPriceUsd)
        : wsLam.unitPriceUzs
        ? Number((wsLam.unitPriceUzs / 12850).toFixed(4))
        : 0;

      const lamItemId = wsLam.sku;
      const lamIdx = items.findIndex((i) => i.id === wsLam.sku);

      if (lamIdx >= 0) {
        const ex = items[lamIdx];
        const planQty = lamMeter;
        const actualQty =
          ex.actualQty > 0 && ex.actualQty !== ex.planQty ? ex.actualQty : planQty;
        items[lamIdx] = {
          ...ex,
          id: lamItemId,
          name: lamName,
          spec: lamSpec,
          category: "Foil & Film",
          planQty,
          actualQty,
          qty: actualQty,
          unit: wsLam.unit || "m",
          unitPrice: ex.unitPrice || lamPrice,
          totalPrice: Number((actualQty * (ex.unitPrice || lamPrice)).toFixed(2)),
          supplier: wsLam.supplier || ex.supplier || "Ombor",
          availability: wsLam.status === "Critical" ? "Low Stock" : (wsLam.status || ex.availability || "In Stock"),
          warehouseLocation: wsLam.location || ex.warehouseLocation || "SHELF-B1",
          warehouseStockLevel: wsLam.stockLevel ?? ex.warehouseStockLevel,
          warehouseAvailable: wsLam.available ?? ex.warehouseAvailable,
        };
      } else {
        const newLam: BomItem = {
          id: lamItemId,
          name: lamName,
          spec: lamSpec,
          category: "Foil & Film",
          planQty: lamMeter,
          actualQty: lamMeter,
          wasteQty: 0,
          qty: lamMeter,
          unit: wsLam.unit || "m",
          unitPrice: lamPrice,
          totalPrice: Number((lamMeter * lamPrice).toFixed(2)),
          supplier: wsLam.supplier || "Ombor",
          availability: wsLam.status === "Critical" ? "Low Stock" : (wsLam.status || "In Stock"),
          issueType: "standard",
          faultParty: "none",
          warehouseLocation: wsLam.location || "SHELF-B1",
          warehouseStockLevel: wsLam.stockLevel,
          warehouseAvailable: wsLam.available,
          sourceType: "warehouse",
        };
        items.push(newLam);
      }
    }
  }

  // 3. Coating (Lak) Sync (Only sync to BOM when a real warehouse stock item is selected)
  const coat = form.coating;
  const isCoatActive = Boolean(coat && coat !== "none" && coat !== "None");

  if (!isCoatActive || !form.coatingStockSku) {
    items = items.filter(
      (i) =>
        !i.id.startsWith("MAT-COAT") &&
        !(i.category === "Inks & Plates" && (i.name.toLowerCase().includes("lak") || i.name.toLowerCase().includes("varnish") || i.name.toLowerCase().includes("uv")))
    );
  } else if (targetQty > 0) {
    const wsCoat = stockList.find((s) => s.sku === form.coatingStockSku);
    if (!wsCoat) {
      items = items.filter(
        (i) =>
          !i.id.startsWith("MAT-COAT") &&
          !(i.category === "Inks & Plates" && (i.name.toLowerCase().includes("lak") || i.name.toLowerCase().includes("varnish") || i.name.toLowerCase().includes("uv")))
      );
    } else {
      // Remove any legacy mock coating items
      items = items.filter((i) => !i.id.startsWith("MAT-COAT") || i.id === wsCoat.sku);
      const parentW = Number(form.parentSheetW) || 700;
      const parentH = Number(form.parentSheetH) || 1000;
      const sheetM2 = (parentW * parentH) / 1000000;
      const totalM2 = requiredPaperSheets * sheetM2;
      const isSpot = coat ? (coat.toLowerCase().includes("spot") || coat.toLowerCase().includes("tanlanma")) : false;
      const gsmRate = isSpot ? 2 : 5;
      const coatKg = Math.max(0.5, Number(((totalM2 * gsmRate) / 1000).toFixed(2)));

      const coatName = wsCoat.name || (form.coatingStockName || (coat ? `${coat} (Lak)` : "Lak"));
      const coatSpec = form.coatingZone ? `Zona: ${form.coatingZone}` : ((wsCoat as any)?.spec || wsCoat.category || "Standart lak qoplami");
      const coatPrice = wsCoat.unitPriceUsd
        ? Number(wsCoat.unitPriceUsd)
        : wsCoat.unitPriceUzs
        ? Number((wsCoat.unitPriceUzs / 12850).toFixed(4))
        : 0;

      const coatItemId = wsCoat.sku;
      const coatIdx = items.findIndex((i) => i.id === wsCoat.sku);

      if (coatIdx >= 0) {
        const ex = items[coatIdx];
        const planQty = coatKg;
        const actualQty = ex.actualQty > 0 && ex.actualQty !== ex.planQty ? ex.actualQty : planQty;
        items[coatIdx] = {
          ...ex,
          id: coatItemId,
          name: coatName,
          spec: coatSpec,
          category: "Inks & Plates",
          planQty,
          actualQty,
          qty: actualQty,
          unit: wsCoat.unit || "kg",
          unitPrice: ex.unitPrice || coatPrice,
          totalPrice: Number((actualQty * (ex.unitPrice || coatPrice)).toFixed(2)),
          supplier: wsCoat.supplier || ex.supplier || "Ombor",
          availability: wsCoat.status === "Critical" ? "Low Stock" : (wsCoat.status || ex.availability || "In Stock"),
          warehouseLocation: wsCoat.location || ex.warehouseLocation || "SHELF-C1",
          warehouseStockLevel: wsCoat.stockLevel ?? ex.warehouseStockLevel,
          warehouseAvailable: wsCoat.available ?? ex.warehouseAvailable,
        };
      } else {
        const newCoat: BomItem = {
          id: coatItemId,
          name: coatName,
          spec: coatSpec,
          category: "Inks & Plates",
          planQty: coatKg,
          actualQty: coatKg,
          wasteQty: 0,
          qty: coatKg,
          unit: wsCoat.unit || "kg",
          unitPrice: coatPrice,
          totalPrice: Number((coatKg * coatPrice).toFixed(2)),
          supplier: wsCoat.supplier || "Ombor",
          availability: wsCoat.status === "Critical" ? "Low Stock" : (wsCoat.status || "In Stock"),
          issueType: "standard",
          faultParty: "none",
          warehouseLocation: wsCoat.location || "SHELF-C1",
          warehouseStockLevel: wsCoat.stockLevel,
          warehouseAvailable: wsCoat.available,
          sourceType: "warehouse",
        };
        items.push(newCoat);
      }
    }
  }

  // 4. Embellishment (Maxsus pardoz) Sync (Only sync to BOM when a real warehouse stock item is selected)
  const emb = form.embellishment;
  const isEmbActive = Boolean(emb && emb !== "none" && emb !== "None");
  const isFoil = Boolean(emb && (emb.toLowerCase().includes("foil") || emb.toLowerCase().includes("folga")));

  if (!isEmbActive || !form.embellishmentStockSku) {
    items = items.filter(
      (i) =>
        !i.id.startsWith("MAT-EMB") &&
        !((i.category === "Foil & Film" || i.category === "Inks & Plates") &&
          (i.name.toLowerCase().includes("folga") || i.name.toLowerCase().includes("foil") || i.name.toLowerCase().includes("serigraf") || i.name.toLowerCase().includes("screen")))
    );
  } else if (targetQty > 0) {
    const wsEmb = stockList.find((s) => s.sku === form.embellishmentStockSku);
    if (!wsEmb) {
      items = items.filter(
        (i) =>
          !i.id.startsWith("MAT-EMB") &&
          !((i.category === "Foil & Film" || i.category === "Inks & Plates") &&
            (i.name.toLowerCase().includes("folga") || i.name.toLowerCase().includes("foil") || i.name.toLowerCase().includes("serigraf") || i.name.toLowerCase().includes("screen")))
      );
    } else {
      // Remove any legacy mock embellishment items
      items = items.filter((i) => !i.id.startsWith("MAT-EMB") || i.id === wsEmb.sku);
      const embQty = isFoil
        ? Math.max(10, Math.ceil(requiredPaperSheets * 0.15))
        : Math.max(0.5, Number(((requiredPaperSheets * 0.0005)).toFixed(2)));

      const embUnit = wsEmb.unit || (isFoil ? "m" : "kg");
      const embCategory = wsEmb.category || (isFoil ? "Foil & Film" : "Inks & Plates");
      const embName = wsEmb.name || (form.embellishmentStockName || (emb || "Maxsus pardoz"));
      const embSpec = form.embellishmentZone ? `Zona: ${form.embellishmentZone}` : ((wsEmb as any)?.spec || wsEmb.category || "Maxsus pardoz");
      const embPrice = wsEmb.unitPriceUsd
        ? Number(wsEmb.unitPriceUsd)
        : wsEmb.unitPriceUzs
        ? Number((wsEmb.unitPriceUzs / 12850).toFixed(4))
        : 0;

      const embItemId = wsEmb.sku;
      const embIdx = items.findIndex((i) => i.id === wsEmb.sku);

      if (embIdx >= 0) {
        const ex = items[embIdx];
        const planQty = embQty;
        const actualQty = ex.actualQty > 0 && ex.actualQty !== ex.planQty ? ex.actualQty : planQty;
        items[embIdx] = {
          ...ex,
          id: embItemId,
          name: embName,
          spec: embSpec,
          category: embCategory,
          planQty,
          actualQty,
          qty: actualQty,
          unit: embUnit,
          unitPrice: ex.unitPrice || embPrice,
          totalPrice: Number((actualQty * (ex.unitPrice || embPrice)).toFixed(2)),
          supplier: wsEmb.supplier || ex.supplier || "Ombor",
          availability: wsEmb.status === "Critical" ? "Low Stock" : (wsEmb.status || ex.availability || "In Stock"),
          warehouseLocation: wsEmb.location || ex.warehouseLocation || "SHELF-D1",
          warehouseStockLevel: wsEmb.stockLevel ?? ex.warehouseStockLevel,
          warehouseAvailable: wsEmb.available ?? ex.warehouseAvailable,
        };
      } else {
        const newEmb: BomItem = {
          id: embItemId,
          name: embName,
          spec: embSpec,
          category: embCategory,
          planQty: embQty,
          actualQty: embQty,
          wasteQty: 0,
          qty: embQty,
          unit: embUnit,
          unitPrice: embPrice,
          totalPrice: Number((embQty * embPrice).toFixed(2)),
          supplier: wsEmb.supplier || "Ombor",
          availability: wsEmb.status === "Critical" ? "Low Stock" : (wsEmb.status || "In Stock"),
          issueType: "standard",
          faultParty: "none",
          warehouseLocation: wsEmb.location || "SHELF-D1",
          warehouseStockLevel: wsEmb.stockLevel,
          warehouseAvailable: wsEmb.available,
          sourceType: "warehouse",
        };
        items.push(newEmb);
      }
    }
  }

  return items;
}

export function recalculateRouteStepsForOrder(
  steps: RouteStep[],
  form: Partial<WorkOrderFormData>,
  tariffs: TariffRecord[] = []
): RouteStep[] {
  const orderQty = Math.max(0, Number(form.quantity) || 0);
  const plannedSheets = Math.max(0, Number((form as any).plannedSheets) || 0);
  const ctpItem = (form.toolingItems || []).find(
    (t) => t.category === "ctp_plates" || t.category === "flexo_polymer"
  );
  const ctpCount = ctpItem ? Math.max(1, Number(ctpItem.quantity) || 1) : 4;

  const isKashirovkaOrder = Boolean(form.kashirovkaMode && form.kashirovkaMode !== "none");
  const isSeparateSheets = form.kashirovkaStrategy === "separate_sheets";
  const layers = form.kashirovkaLayers || [];
  const printedLinersCount =
    layers.length > 0
      ? layers.filter((l) => l.role !== "core_board" && l.colors !== "0+0").length
      : 2;

  const isKashirovkaOp = (op: RouteStep, matchedTariff: TariffRecord | null) =>
    matchedTariff?.category === "Kashirovka (Mounting)" ||
    op.calcUnit === "1,000 glue passes" ||
    /kashir|mounting|dupleks|tripleks/i.test(op.name || "");

  const findTariff = (op: RouteStep) =>
    tariffs.find(
      (t) =>
        (op.tariffId && t.id === op.tariffId) ||
        (op.tariffCode && t.code === op.tariffCode)
    ) || null;

  const kashirovkaStepIndex = steps.findIndex((op) =>
    isKashirovkaOp(op, findTariff(op))
  );

  const isPrintOpName = (op: RouteStep) =>
    /bosma|print|ofset/i.test(op.name || "") || op.calcUnit === "1,000 impressions";
  const isPreFinishOpName = (op: RouteStep) =>
    /laminat|lak|varnish|uv/i.test(op.name || "") &&
    !/kashir|mounting|tigel|die|kesish|yelim/i.test(op.name || "");

  const preSteps =
    kashirovkaStepIndex !== -1 ? steps.slice(0, kashirovkaStepIndex) : steps;
  const prePrintStepsCount = preSteps.filter(isPrintOpName).length;
  const preFinishStepsCount = preSteps.filter(isPreFinishOpName).length;

  return steps.map((op, idx) => {
    const matchedTariff = findTariff(op);
    const isPlateOp =
      op.calcUnit === "1 plate" || /ctp|qolip|polimer|plate/i.test(op.name || "");
    const isSheetOp =
      !isPlateOp &&
      (op.calcUnit === "1,000 sheets" ||
        op.calcUnit === "1,000 impressions" ||
        op.calcUnit === "1,000 strokes" ||
        op.calcUnit === "1,000 glue passes" ||
        (plannedSheets > 0 && /bosma|laminat|lak|tigel|kashirovka/i.test(op.name || "")));

    let targetNum = orderQty;
    let unitSuffix = "";
    if (isPlateOp) {
      targetNum = ctpCount;
      unitSuffix = " dona";
    } else if (isSheetOp && plannedSheets > 0) {
      let sheetMultiplier = 1;
      const isBeforeKashirovka =
        kashirovkaStepIndex === -1 || idx < kashirovkaStepIndex;
      if (
        isKashirovkaOrder &&
        isSeparateSheets &&
        printedLinersCount > 1 &&
        isBeforeKashirovka &&
        !isKashirovkaOp(op, matchedTariff)
      ) {
        if (isPrintOpName(op) && prePrintStepsCount <= 1) {
          sheetMultiplier = printedLinersCount;
        } else if (isPreFinishOpName(op) && preFinishStepsCount <= 1) {
          sheetMultiplier = printedLinersCount;
        }
      }
      targetNum = plannedSheets * sheetMultiplier;
      unitSuffix = " list";
    }

    const doneMatch = (op.qtyCompleted || "").match(/^([\d,\s]+)\s*\//);
    const donePrefix = doneMatch ? doneMatch[1].trim() : "0";
    const nextQtyCompleted = `${donePrefix} / ${targetNum.toLocaleString()}${unitSuffix}`;

    if (matchedTariff) {
      const est = computeTariffEstimate(matchedTariff, targetNum);
      return {
        ...op,
        stepNumber: (idx + 1) * 10,
        qtyCompleted: nextQtyCompleted,
        tariffId: matchedTariff.id,
        tariffCode: matchedTariff.code,
        calcUnit: matchedTariff.unit,
        unitDivisor: matchedTariff.unitDivisor,
        rateUsd: est.effectiveRate,
        setupFeeUsd: est.effectiveSetup,
        pieceworkRateUsd: matchedTariff.pieceworkRateUsd,
        plannedCostUsd: est.netCost,
        pieceworkTotalUsd: est.pieceworkTotal,
        duration:
          est.totalMachineHours > 0
            ? Number(est.totalMachineHours.toFixed(1))
            : op.duration || 1,
      };
    }

    const divisor = op.unitDivisor && op.unitDivisor > 0 ? op.unitDivisor : 1000;
    const units = targetNum / divisor;
    const hasRates = (op.rateUsd && op.rateUsd > 0) || (op.pieceworkRateUsd && op.pieceworkRateUsd > 0);

    return {
      ...op,
      stepNumber: (idx + 1) * 10,
      qtyCompleted: nextQtyCompleted,
      ...(hasRates
        ? {
            plannedCostUsd: Number(((op.setupFeeUsd || 0) + units * (op.rateUsd || 0)).toFixed(2)),
            pieceworkTotalUsd: Number((units * (op.pieceworkRateUsd || 0)).toFixed(2)),
          }
        : {}),
    };
  });
}

export function buildOperationsFromSpec(
  spec: any,
  form: Partial<WorkOrderFormData>,
  tariffs: TariffRecord[] = []
): RouteStep[] {
  const specOps = spec && Array.isArray(spec.operations) ? spec.operations : [];
  if (specOps.length > 0) {
    const rawSteps: RouteStep[] = specOps.map((op: any, idx: number) => {
      const rawMachine = op.machineStr || op.machine || "";
      const resolvedMachine =
        rawMachine === "PRESS_MACHINE" || (!rawMachine && /bosma|print/i.test(op.name || ""))
          ? form.pressMachine || ""
          : rawMachine;
      return {
        id: op.id ? `op-spec-${idx + 1}-${op.id}` : `op-spec-${idx + 1}-${Date.now()}`,
        stepNumber: (idx + 1) * 10,
        name: op.name || "",
        department: spec.department || form.department,
        machine: resolvedMachine,
        operator: op.operator || "",
        duration: Number(op.durationHours ?? op.duration ?? 1),
        qtyCompleted: `0 / ${(Number(form.quantity) || 0).toLocaleString()}`,
        status: "Queued",
        tariffId: op.tariffId,
        tariffCode: op.tariffCode,
        calcUnit: op.calcUnit,
        unitDivisor: op.unitDivisor,
        rateUsd: op.rateUsd !== undefined ? Number(op.rateUsd) : undefined,
        setupFeeUsd: op.setupFeeUsd !== undefined ? Number(op.setupFeeUsd) : undefined,
        pieceworkRateUsd:
          op.pieceworkRateUsd !== undefined ? Number(op.pieceworkRateUsd) : undefined,
      };
    });
    return recalculateRouteStepsForOrder(rawSteps, form, tariffs);
  }

  const fallback = getInitialOperations(
    spec?.code || form.recipe || "",
    form.pressMachine || "",
    spec?.department || form.department || "Offset",
    Number(form.quantity) || 0
  );
  return recalculateRouteStepsForOrder(fallback, form, tariffs);
}


/**
 * Puts a route step where its "Tartib #" says among the production steps, keeps packaging last,
 * and renumbers the route 10, 20, 30... A step taking an existing number goes before that step,
 * unless it is an existing step moved down the route (#20 -> 40 lands after the old #40).
 */
function placeRouteStep(others: RouteStep[], step: RouteStep, previousNumber?: number): RouteStep[] {
  const packaging = others.filter((op) => op.kind === "packaging");
  const production = others.filter((op) => op.kind !== "packaging");
  if (step.kind === "packaging") {
    packaging.push(step);
  } else {
    const target = Number(step.stepNumber) || Number.MAX_SAFE_INTEGER;
    const movedDown = previousNumber !== undefined && target > previousNumber;
    const at = production.findIndex((op) =>
      movedDown ? (Number(op.stepNumber) || 0) > target : (Number(op.stepNumber) || 0) >= target
    );
    production.splice(at === -1 ? production.length : at, 0, step);
  }
  return [...production, ...packaging].map((op, idx) => ({ ...op, stepNumber: (idx + 1) * 10 }));
}

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const tAct = useTranslations("DeliveryAct");
  const tShell = useTranslations("DocumentShell");
  const {
    currentUser,
    theme,
    masterSpecifications,
    machines: storeMachines,
    warehouseStock,
    plants,
    tariffs,
  } = useWorkspaceStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      theme: s.theme,
      masterSpecifications: s.masterSpecifications,
      machines: s.machines,
      warehouseStock: s.warehouseStock,
      plants: s.plants,
      tariffs: s.tariffs,
    }))
  );

  const {
    setTabUnsaved,
    updateTabData,
    replaceTabId,
    upsertProductionQueueItem,
    upsertWorkOrderAsync,
    deleteWorkOrderAsync,
    toggleReadinessCheck,
    loadProductionQueue,
    closeTab,
    requestCloseTab,
    setLevel3Tab,
    openTab,
    addNotification,
    createDeliveryActFromOrder,
    loadSpecificationsAsync,
    upsertMasterSpecification,
    loadCrmCustomers,
    loadMachines,
    loadWarehouseStock,
    fetchPlants,
  } = useWorkspaceStore.getState();

  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.productionQueue.length === 0 && s.loadProductionQueue) {
      s.loadProductionQueue();
    }
    if (s.crmCustomers.length === 0 && s.loadCrmCustomers) {
      s.loadCrmCustomers();
    }
    if (s.machines.length === 0 && s.loadMachines) {
      s.loadMachines();
    }
    if (s.employees.length === 0 && s.loadEmployees) {
      s.loadEmployees();
    }
    if (s.warehouseStock.length === 0 && s.loadWarehouseStock) {
      s.loadWarehouseStock();
    }
    if (s.masterSpecifications.length === 0 && s.loadSpecificationsAsync) {
      s.loadSpecificationsAsync();
    }
    if (!s.plants || s.plants.length === 0) {
      if (s.fetchPlants) s.fetchPlants();
    }
    if (!s.tariffs || s.tariffs.length === 0) {
      if (s.fetchTariffs) s.fetchTariffs();
    }
  }, []);
  const isDark = theme === "dark";
  const data = tab.documentData || {};

  // Find real queue item from workspaceStore to ensure all photos and attachments are 100% available
  const initialDocNo = data.docNo || (tab.id.startsWith("draft-") || tab.id.startsWith("temp-") ? "" : tab.id);
  const [docNo, setDocNo] = useState(initialDocNo);
  const savedDocNoRef = React.useRef<string>(initialDocNo);
  const isSavingRef = React.useRef<boolean>(false);
  const persistOrderDetailsRef = React.useRef<() => Promise<string>>(null!);
  const persistAfterRenderRef = React.useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isDraft = !docNo || tab.id.startsWith("draft-") || tab.id.startsWith("temp-");

  const queueLookupKey = (docNo || tab.id || "").trim().toLowerCase();
  const initialQueueItem = useWorkspaceStore.getState().productionQueue.find((q) => {
    return (
      q.id?.toLowerCase() === queueLookupKey ||
      (q.docNo && q.docNo.toLowerCase() === queueLookupKey) ||
      (q.clientOrderId && q.clientOrderId.toLowerCase() === queueLookupKey)
    );
  });
  const queueItem = useWorkspaceStore(
    useCallback(
      (s) =>
        s.productionQueue.find((q) => {
          return (
            q.id?.toLowerCase() === queueLookupKey ||
            (q.docNo && q.docNo.toLowerCase() === queueLookupKey) ||
            (q.clientOrderId && q.clientOrderId.toLowerCase() === queueLookupKey)
          );
        }),
      [queueLookupKey]
    )
  );

  const effectivePhotoUrl = data.photoUrl || (data.photoUrls && data.photoUrls[0]) || initialQueueItem?.photoUrl || (initialQueueItem?.photoUrls && initialQueueItem?.photoUrls[0]) || "";
  const effectivePhotoUrls: string[] = (data.photoUrls && data.photoUrls.length > 0)
    ? data.photoUrls
    : (data.photoUrl
        ? [data.photoUrl]
        : (initialQueueItem?.photoUrls && initialQueueItem?.photoUrls.length > 0
            ? initialQueueItem.photoUrls
            : (initialQueueItem?.photoUrl ? [initialQueueItem.photoUrl] : [])));
  const initialAttachments = (data.attachments && data.attachments.length > 0)
    ? data.attachments
    : (initialQueueItem?.attachments && initialQueueItem.attachments.length > 0 ? initialQueueItem.attachments : []);

  // Role-Based Access Control (RBAC): Determine operator mode automatically from currentUser
  const isOperator = useMemo(() => {
    if (!currentUser) return false;
    // Admins and managers have full access
    if (currentUser.role === "admin" || currentUser.role === "System Administrator") {
      return false;
    }
    const role = (currentUser.role || "").toLowerCase();
    // If role indicates an operator / pressman / floor technician
    if (role.includes("operator") || role.includes("pressman") || role.includes("stanokchi")) {
      return true;
    }
    // If user explicitly lacks production edit permissions
    if (currentUser.permissions?.production && !currentUser.permissions.production.edit) {
      return true;
    }
    return false;
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || "").toLowerCase();
    return (
      role === "admin" ||
      role === "system administrator" ||
      role === "administrator" ||
      role === "boshliq"
    );
  }, [currentUser]);

  const canDelete = useMemo(() => {
    return isAdmin || currentUser?.permissions?.production?.delete === true;
  }, [isAdmin, currentUser]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"cancel" | "hard_delete">("cancel");
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRequestDelete = () => {
    if (!canDelete) {
      addNotification({
        title: tOrder("insufficientPermissionTitle"),
        description: tOrder("insufficientPermissionDesc"),
        severity: "error",
      });
      return;
    }

    const currentTargetId = savedDocNoRef.current || docNo || tab.id;
    if (currentTargetId.startsWith("draft-") || currentTargetId.startsWith("temp-")) {
      closeTab(tab.id);
      addNotification({
        title: tOrder("draftClosedTitle"),
        description: tOrder("draftClosedDesc"),
        severity: "info",
      });
      return;
    }

    setDeleteReason("");
    const isCleanDraft =
      formData.status === "Draft" ||
      operations.length === 0 ||
      operations.every((op) => op.status === "Queued" || !op.qtyCompleted || op.qtyCompleted.startsWith("0 /"));
    setDeleteMode(isCleanDraft ? "hard_delete" : "cancel");
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    const targetDocNo = savedDocNoRef.current || docNo || tab.id;
    setIsDeleting(true);
    try {
      const res = await deleteWorkOrderAsync(targetDocNo, deleteMode, deleteReason);
      if (res.success) {
        addNotification({
          title: res.mode === "deleted" ? tOrder("orderDeletedTitle") : tOrder("orderCancelledTitle"),
          description:
            res.message ||
            `${targetDocNo} ${res.mode === "deleted" ? tOrder("orderDeletedTitle") : tOrder("orderCancelledTitle")}.`,
          severity: "success",
          channel: "toast",
        });
        setIsDeleteModalOpen(false);
        if (res.mode === "deleted") {
          closeTab(tab.id);
        } else {
          setFormData((prev) => ({ ...prev, status: "Cancelled" }));
        }
      } else {
        addNotification({
          title: "Xatolik",
          description: res.error || "Buyurtmani o'chirishda xatolik yuz berdi.",
          severity: "error",
          channel: "toast",
        });
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err?.message || "Buyurtmani o'chirishda kutilmagan xatolik yuz berdi.",
        severity: "error",
        channel: "toast",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Kashirovka layer colours follow the order colours, also for orders saved before that rule
  const [formData, setFormData] = useState<WorkOrderFormData>(() => withSyncedKashirovkaColors({
    customer: data.customer || initialQueueItem?.customer || "",
    product: data.product || initialQueueItem?.product || "",
    productType: data.productType || initialQueueItem?.productType || "",
    department: data.department || initialQueueItem?.department || "Offset",
    site: data.site || initialQueueItem?.site || "",
    recipe: data.recipe || initialQueueItem?.recipe || "",
    quantity: data.quantity || initialQueueItem?.quantity || 0,
    unit: data.unit || initialQueueItem?.unit || "pcs",
    status: data.status || (initialQueueItem?.stage === "In Production" ? "In Production" : "Draft"),
    stage: (data as any).stage || initialQueueItem?.stage || "Queue",
    checks: data.checks || initialQueueItem?.checks || {
      designReady: false,
      paperReady: false,
      platesReady: false,
      toolingReady: false,
    },
    priority: data.priority || initialQueueItem?.priority || "Normal",
    pressMachine: data.pressMachine || initialQueueItem?.pressMachine || "",
    orderDate: data.orderDate || initialQueueItem?.orderDate || new Date().toISOString().split("T")[0],
    startDate: data.startDate || initialQueueItem?.startDate || "",
    deadline: data.deadline || initialQueueItem?.deadline || "",
    actualEndDate: data.actualEndDate || initialQueueItem?.actualEndDate || "",
    paperStock: data.paperStock || initialQueueItem?.paperStock || "",
    paperDensity: data.paperDensity ?? initialQueueItem?.paperDensity ?? undefined,
    targetGsm: data.targetGsm ?? initialQueueItem?.targetGsm ?? undefined,
    coating: data.coating || initialQueueItem?.coating || "",
    coatingStockSku: data.coatingStockSku || (initialQueueItem as any)?.coatingStockSku || "",
    coatingStockName: data.coatingStockName || (initialQueueItem as any)?.coatingStockName || "",
    lamination: data.lamination || initialQueueItem?.lamination || "",
    laminationSides: data.laminationSides || initialQueueItem?.laminationSides || "1s",
    laminationMicron: data.laminationMicron ?? initialQueueItem?.laminationMicron ?? 0,
    laminationStockSku: data.laminationStockSku || (initialQueueItem as any)?.laminationStockSku || "",
    laminationStockName: data.laminationStockName || (initialQueueItem as any)?.laminationStockName || "",
    embellishment: data.embellishment || initialQueueItem?.embellishment || "",
    embellishmentStockSku: data.embellishmentStockSku || (initialQueueItem as any)?.embellishmentStockSku || "",
    embellishmentStockName: data.embellishmentStockName || (initialQueueItem as any)?.embellishmentStockName || "",
    coatingZone: data.coatingZone || initialQueueItem?.coatingZone || (data.dimensions as any)?.coatingZone || (initialQueueItem?.dimensions as any)?.coatingZone || "",
    embellishmentZone: data.embellishmentZone || initialQueueItem?.embellishmentZone || (data.dimensions as any)?.embellishmentZone || (initialQueueItem?.dimensions as any)?.embellishmentZone || "",
    priceTotal: data.priceTotal || initialQueueItem?.priceTotal || 0,
    currency: data.currency || initialQueueItem?.currency || "UZS",
    exchangeRate: data.exchangeRate || (initialQueueItem as any)?.exchangeRate || 12850,
    photoUrl: effectivePhotoUrl,
    photoUrls: effectivePhotoUrls,
    artworkFront: data.artworkFront || initialQueueItem?.artworkFront || "",
    artworkBack: data.artworkBack || initialQueueItem?.artworkBack || "",
    itemCategory: data.itemCategory || initialQueueItem?.itemCategory || "",
    width: data.width || initialQueueItem?.width || data.dimensions?.width || initialQueueItem?.dimensions?.width || 0,
    height: data.height || initialQueueItem?.height || data.dimensions?.height || initialQueueItem?.dimensions?.height || 0,
    dimensionUnit: data.dimensionUnit || initialQueueItem?.dimensionUnit || "mm",
    cornerType: data.cornerType || initialQueueItem?.cornerType || data.dimensions?.cornerType || initialQueueItem?.dimensions?.cornerType || "Square",
    bleed: data.bleed ?? initialQueueItem?.bleed ?? data.dimensions?.bleed ?? 0,
    shapeType: data.shapeType || initialQueueItem?.shapeType || data.dimensions?.shapeType || "rectangle",
    foldType: data.foldType || initialQueueItem?.foldType || data.dimensions?.foldType || "",
    boxType: data.boxType || initialQueueItem?.boxType || data.dimensions?.boxType || "",
    boxDepth: data.boxDepth ?? initialQueueItem?.boxDepth ?? data.dimensions?.boxDepth ?? 0,
    customShape: data.customShape || initialQueueItem?.customShape || data.dimensions?.customShape || "",
    customSvgPath: data.customSvgPath || initialQueueItem?.customSvgPath || data.dimensions?.customSvgPath || "",
    colorsConfig: data.colorsConfig || initialQueueItem?.colorsConfig || initialQueueItem?.colors || "",
    frontColors: data.frontColors || initialQueueItem?.frontColors || { c: false, m: false, y: false, k: false },
    backColors: data.backColors || initialQueueItem?.backColors || { c: false, m: false, y: false, k: false },
    spotColors: (data.spotColors && data.spotColors.length > 0) ? data.spotColors : (initialQueueItem?.spotColors || []),
    spotColorItems: (data.spotColorItems && data.spotColorItems.length > 0) ? data.spotColorItems : (initialQueueItem?.spotColorItems || []),
    holeSize: data.holeSize ?? initialQueueItem?.holeSize ?? data.dimensions?.holeSize ?? 0,
    holePosition: data.holePosition || initialQueueItem?.holePosition || data.dimensions?.holePosition || "none",
    holeOffset: data.holeOffset ?? initialQueueItem?.holeOffset ?? data.dimensions?.holeOffset ?? 0,
    sizes: (data.sizes && data.sizes.length > 0) ? data.sizes : (initialQueueItem?.sizes || []),
    kashirovkaMode: data.kashirovkaMode || initialQueueItem?.kashirovkaMode || "none",
    kashirovkaStrategy: data.kashirovkaStrategy || initialQueueItem?.kashirovkaStrategy || "split_half_sheet",
    kashirovkaLayers: (data.kashirovkaLayers && data.kashirovkaLayers.length > 0) ? data.kashirovkaLayers : (initialQueueItem?.kashirovkaLayers || []),
    kashirovkaGlueGsm: data.kashirovkaGlueGsm ?? initialQueueItem?.kashirovkaGlueGsm ?? 0,
    kashirovkaMakeReadySheets: data.kashirovkaMakeReadySheets ?? initialQueueItem?.kashirovkaMakeReadySheets ?? 0,
    kashirovkaCuringHours: data.kashirovkaCuringHours ?? initialQueueItem?.kashirovkaCuringHours ?? 0,
    selectedToolingId: data.selectedToolingId || initialQueueItem?.selectedToolingId || "",
    selectedToolingName: data.selectedToolingName || initialQueueItem?.selectedToolingName || "",
    toolingProcurementNeeded: data.toolingProcurementNeeded ?? initialQueueItem?.toolingProcurementNeeded ?? false,
    toolingProcurementCost: data.toolingProcurementCost ?? initialQueueItem?.toolingProcurementCost ?? 0,
    milestones: data.milestones || initialQueueItem?.milestones || [],
    financials: data.financials || initialQueueItem?.financials,
    parentWorkOrderId: data.parentWorkOrderId || data.linkedWoId || undefined,
    isReorder: data.isReorder ?? Boolean(data.parentWorkOrderId),
    toolingItems: getInitialToolingItems(
      {
        ...initialQueueItem,
        ...data,
        toolingItems:
          data.toolingItems ||
          (data.dimensions as any)?.toolingItems ||
          initialQueueItem?.toolingItems ||
          (initialQueueItem?.dimensions as any)?.toolingItems,
        plannedSheets:
          (data as any).plannedSheets ||
          (initialQueueItem as any)?.plannedSheets ||
          (data.dimensions as any)?.plannedSheets,
      },
      docNo || tab.id
    ),
    parentSheetW: data.parentSheetW || (initialQueueItem as any)?.parentSheetW || (data.dimensions as any)?.parentSheetW,
    parentSheetH: data.parentSheetH || (initialQueueItem as any)?.parentSheetH || (data.dimensions as any)?.parentSheetH,
    pressSheetW: data.pressSheetW || (initialQueueItem as any)?.pressSheetW || (data.dimensions as any)?.pressSheetW,
    pressSheetH: data.pressSheetH || (initialQueueItem as any)?.pressSheetH || (data.dimensions as any)?.pressSheetH,
    plannedSheets: (data as any).plannedSheets || (initialQueueItem as any)?.plannedSheets || (data.dimensions as any)?.plannedSheets,
    impositionState: (data as any).impositionState || (initialQueueItem as any)?.impositionState || (data.dimensions as any)?.impositionState,
    flexoImpositionState: (data as any).flexoImpositionState || (initialQueueItem as any)?.flexoImpositionState || (data.dimensions as any)?.flexoImpositionState,
    dieline: (data as any).dieline || (initialQueueItem as any)?.dieline || (data.dimensions as any)?.dieline,
  }));

  const [orderAttachments, setOrderAttachments] = useState<OrderAttachment[]>(() => {
    const list = initialAttachments && Array.isArray(initialAttachments) ? [...initialAttachments] : [];
    const existingUrls = new Set(list.map((a: any) => a.url));
    const allPhotos: string[] = effectivePhotoUrls;

    allPhotos.forEach((url, idx) => {
      if (url && !existingUrls.has(url)) {
        list.push({
          id: `att-initial-photo-${idx}`,
          name: `Sample_Proof_${idx + 1}.jpg`,
          size: "Sample Proof",
          type: "image/jpeg",
          date: new Date().toISOString().slice(0, 16).replace("T", " "),
          isImage: true,
          url,
        });
        existingUrls.add(url);
      }
    });

    // Also include any pre-existing SKU Artworks in the attachments list
    const initialSkus: SkuArtwork[] =
      data.skuArtworks ||
      initialQueueItem?.skuArtworks ||
      data.dimensions?.skuArtworks ||
      initialQueueItem?.dimensions?.skuArtworks ||
      [];
    if (Array.isArray(initialSkus)) {
      initialSkus.forEach((sku) => {
        if (sku.frontArtworkUrl && !existingUrls.has(sku.frontArtworkUrl)) {
          const skuLabel = sku.model ? `${sku.model} ${sku.sizeCode || ""}` : (sku.sizeCode || "SKU");
          list.push({
            id: `att-art-${sku.skuId}-front`,
            name: `[${skuLabel} / Oldi] ${sku.frontArtworkName || "front.pdf"}`,
            size: "Artwork",
            type: sku.frontArtworkUrl.endsWith(".svg") ? "image/svg+xml" : "application/pdf",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: sku.frontArtworkUrl.endsWith(".svg"),
            category: "artwork",
            url: sku.frontArtworkUrl,
          });
          existingUrls.add(sku.frontArtworkUrl);
        }
        if (sku.backArtworkUrl && !existingUrls.has(sku.backArtworkUrl)) {
          const skuLabel = sku.model ? `${sku.model} ${sku.sizeCode || ""}` : (sku.sizeCode || "SKU");
          list.push({
            id: `att-art-${sku.skuId}-back`,
            name: `[${skuLabel} / Orqa] ${sku.backArtworkName || "back.pdf"}`,
            size: "Artwork",
            type: sku.backArtworkUrl.endsWith(".svg") ? "image/svg+xml" : "application/pdf",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: sku.backArtworkUrl.endsWith(".svg"),
            category: "artwork",
            url: sku.backArtworkUrl,
          });
          existingUrls.add(sku.backArtworkUrl);
        }
      });
    }

    // Also include any pre-existing Tooling images & CAD files in the attachments list
    const initialTools: WorkOrderToolingItem[] =
      data.toolingItems ||
      initialQueueItem?.toolingItems ||
      (initialQueueItem?.dimensions as any)?.toolingItems ||
      (data.dimensions as any)?.toolingItems ||
      [];
    if (Array.isArray(initialTools)) {
      initialTools.forEach((tool) => {
        if (tool.imageUrl && !existingUrls.has(tool.imageUrl)) {
          list.push({
            id: `att-tool-img-${tool.id}`,
            name: `[Jihoz: ${tool.name}] Foto`,
            size: "Jihoz rasmi",
            type: "image/jpeg",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: true,
            category: "proofs",
            url: tool.imageUrl,
          });
          existingUrls.add(tool.imageUrl);
        }
        if (tool.fileUrl && !existingUrls.has(tool.fileUrl)) {
          const ext = tool.fileName ? tool.fileName.split(".").pop()?.toLowerCase() : "cad";
          let cat: "dieline" | "artwork" | "proofs" | "docs" = "dieline";
          if (["ai", "eps", "cdr"].includes(ext || "")) cat = "artwork";
          else if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) cat = "proofs";
          else if (["pdf", "dxf", "cf2", "ard"].includes(ext || "")) cat = "dieline";

          list.push({
            id: `att-tool-file-${tool.id}`,
            name: `[Chizma: ${tool.name}] ${tool.fileName || "dieline.pdf"}`,
            size: "Texnik chizma",
            type: ext ? ext.toUpperCase() : "CAD",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: Boolean(tool.fileUrl.startsWith("data:image/") || tool.fileName?.match(/\.(png|jpe?g|webp|svg)$/i)),
            category: cat,
            url: tool.fileUrl,
          });
          existingUrls.add(tool.fileUrl);
        }
      });
    }

    return list;
  });

  const [skuArtworks, setSkuArtworks] = useState<SkuArtwork[]>(
    data.skuArtworks || initialQueueItem?.skuArtworks || data.dimensions?.skuArtworks || initialQueueItem?.dimensions?.skuArtworks || []
  );

  const [currentBomItems, setCurrentBomItems] = useState<BomItem[]>(() => {
    const raw =
      data.materials ||
      initialQueueItem?.materials ||
      (initialQueueItem?.dimensions as any)?.materials;
    const baseItems: BomItem[] =
      raw && Array.isArray(raw) && raw.length > 0 ? raw.map(normalizeBomItem) : [];
    return syncBomWithSpecs(
      baseItems,
      {
        paperStock: data.paperStock || initialQueueItem?.paperStock,
        lamination: data.lamination || initialQueueItem?.lamination,
        laminationSides: data.laminationSides || initialQueueItem?.laminationSides,
        laminationMicron: data.laminationMicron || initialQueueItem?.laminationMicron,
        laminationStockSku: data.laminationStockSku || (initialQueueItem as any)?.laminationStockSku,
        coating: data.coating || initialQueueItem?.coating,
        coatingStockSku: data.coatingStockSku || (initialQueueItem as any)?.coatingStockSku,
        coatingZone: data.coatingZone || initialQueueItem?.coatingZone,
        embellishment: data.embellishment || initialQueueItem?.embellishment,
        embellishmentStockSku: data.embellishmentStockSku || (initialQueueItem as any)?.embellishmentStockSku,
        embellishmentZone: data.embellishmentZone || initialQueueItem?.embellishmentZone,
        quantity: data.quantity || initialQueueItem?.quantity,
        parentSheetW: (data as any).parentSheetW || (initialQueueItem as any)?.parentSheetW,
        parentSheetH: (data as any).parentSheetH || (initialQueueItem as any)?.parentSheetH,
      },
      useWorkspaceStore.getState().warehouseStock
    );
  });

  // On mount and when warehouseStock loads: cleanse legacy mock materials and sync BOM
  useEffect(() => {
    setCurrentBomItems((prev) => {
      const synced = syncBomWithSpecs(prev, formData, warehouseStock);
      if (JSON.stringify(synced) !== JSON.stringify(prev)) {
        updateTabData(tab.id, { materials: synced });
        syncPaperReadiness(synced);
        return synced;
      }
      return prev;
    });
  }, [warehouseStock.length]);

  // Keep state synchronized with queueItem if loaded asynchronously or updated via readiness gates
  useEffect(() => {
    if (queueItem?.checks) {
      setFormData((prev) => {
        if (JSON.stringify(prev.checks) !== JSON.stringify(queueItem.checks)) {
          return { ...prev, checks: queueItem.checks };
        }
        return prev;
      });
    }
    if (queueItem?.stage) {
      const nextStage = queueItem.stage;
      setFormData((prev) => {
        const nextStatus = deriveWorkOrderStatus(prev.status, nextStage);
        if (prev.stage === nextStage && prev.status === nextStatus) return prev;
        return { ...prev, stage: nextStage, status: nextStatus };
      });
    }

    if (queueItem && !tab.isUnsaved) {
      if (!formData.photoUrl && (queueItem.photoUrl || (queueItem.photoUrls && queueItem.photoUrls.length > 0))) {
        const qUrl = queueItem.photoUrl || queueItem.photoUrls![0];
        const qUrls = queueItem.photoUrls && queueItem.photoUrls.length > 0 ? queueItem.photoUrls : [qUrl];
        setFormData((prev) => ({
          ...prev,
          photoUrl: qUrl,
          photoUrls: qUrls,
          artworkFront: prev.artworkFront || data.artworkFront || "",
        }));
      }
      if (queueItem.attachments && queueItem.attachments.length > 0 && orderAttachments.length === 0) {
        setOrderAttachments(queueItem.attachments);
      }
      if (queueItem.skuArtworks && queueItem.skuArtworks.length > 0 && skuArtworks.length === 0) {
        setSkuArtworks(queueItem.skuArtworks);
      }
      if (queueItem.toolingItems && queueItem.toolingItems.length > 0 && (!formData.toolingItems || formData.toolingItems.length === 0)) {
        setFormData((prev) => ({ ...prev, toolingItems: queueItem.toolingItems }));
      }
      if (queueItem.materials && queueItem.materials.length > 0 && (!currentBomItems || currentBomItems.length === 0)) {
        const synced = syncBomWithSpecs(
          queueItem.materials.map(normalizeBomItem),
          formData,
          useWorkspaceStore.getState().warehouseStock
        );
        setCurrentBomItems(synced);
      }
    }
  }, [queueItem, tab.isUnsaved, formData.photoUrl, orderAttachments.length, skuArtworks.length, formData.toolingItems?.length, currentBomItems.length]);

  const handleSkuArtworksChange = (artworks: SkuArtwork[]) => {
    setSkuArtworks(artworks);
    setFormData((prev) => ({ ...prev, skuArtworks: artworks }));
    updateTabData(tab.id, { skuArtworks: artworks });
    setTabUnsaved(tab.id, true);
  };

  const [sampleData, setSampleData] = useState<WorkOrderSampleData>({
    isRequired: data.orderType === "Sample" || data.sampleRequired === true,
    sampleQty: data.sampleQty || 0,
    testPurpose: data.sampleTestPurpose || "color_proof",
    testMachine: data.sampleTestMachine || "",
    substrateSource: data.sampleSubstrateSource || "precut",
    technicalNotes: data.sampleTechNotes || "",
    isProduced: data.sampleProduced || false,
    producedAt: data.sampleProducedAt || undefined,
    producedBy: data.sampleProducedBy || undefined,
    qcPassed: data.sampleQcPassed || false,
    qcNotes: data.sampleQcNotes || undefined,
    approvalStatus: data.sampleApprovalStatus || "none",
    approvedAt: data.sampleApprovedAt || undefined,
    approvedBy: data.sampleApprovedBy || undefined,
    revisions: data.sampleRevisions || [],
    sampleTargetSize: data.sampleTargetSize || data.sampleSize || undefined,
  });

  const handleSampleChange = (field: keyof WorkOrderSampleData, val: any) => {
    setSampleData((prev) => ({ ...prev, [field]: val }));
    updateTabData(tab.id, { [field]: val });
    setTabUnsaved(tab.id, true);
  };

  const handleApproveSampleAndRelease = () => {
    const today = new Date().toISOString().split("T")[0];
    const approver = currentUser?.name || "Bosh Texnolog";
    const massQty = formData.quantity || 5000;

    setSampleData((prev) => ({
      ...prev,
      approvalStatus: "approved",
      approvedAt: today,
      approvedBy: approver,
      qcPassed: true,
      isProduced: true,
    }));

    handleFieldChange("orderType", "Production");
    handleFieldChange("status", "In Production");
    handleFieldChange("stage", "In Production");

    // Scale operations target to full mass quantity
    setOperations((prev) =>
      prev.map((op, idx) => ({
        ...op,
        qtyCompleted: `0 / ${massQty.toLocaleString()}`,
        status: idx === 0 ? "In Progress" : "Queued",
      }))
    );

    const docNo = data.docNo || tab.id;
    if (!docNo.startsWith("draft-") && !docNo.startsWith("temp-")) {
      upsertProductionQueueItem({
        id: docNo,
        stage: "Ready to Print",
        sampleStatus: "approved",
        sampleRequired: true,
        quantity: massQty,
      });
    }

    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Namuna tasdiqlandi — Asosiy tirajga ruxsat berildi",
      description: `${docNo}: ${formData.product} buyurtmasi to'liq tiraj (${massQty.toLocaleString()} ${formData.unit}) bilan mashina navbatiga chiqarildi.`,
      severity: "success",
    });
  };

  const handleRejectSample = (
    reasonCategory: SampleRevisionRecord["reasonCategory"],
    notes: string
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const reporter = currentUser?.name || "Bosh Texnolog / OTK";
    const newRev: SampleRevisionRecord = {
      id: `rev-${Date.now()}`,
      revisionNumber: (sampleData.revisions?.length || 0) + 1,
      date: today,
      reasonCategory,
      notes,
      reportedBy: reporter,
    };

    setSampleData((prev) => ({
      ...prev,
      approvalStatus: "revision_requested",
      isProduced: false,
      qcPassed: false,
      revisions: [newRev, ...(prev.revisions || [])],
    }));

    const docNo = data.docNo || tab.id;
    if (!docNo.startsWith("draft-") && !docNo.startsWith("temp-")) {
      upsertProductionQueueItem({
        id: docNo,
        stage: "Queue",
        sampleStatus: "revision_requested",
      });
    }

    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Namuna qayta ishlashga qaytarildi (Revision)",
      description: `${docNo}: Sabab — ${notes}`,
      severity: "warning",
    });
  };

  // Operations Route State
  const [operations, setOperations] = useState<RouteStep[]>(
    data.operations || []
  );

  // Every non-empty route ends with one typed packaging step, whatever built it (template, plan, manual edits).
  useEffect(() => {
    const normalized = ensurePackagingStep(operations, Number(formData.quantity) || 0);
    if (normalized !== operations) setOperations(normalized);
  }, [operations, formData.quantity]);

  // Short box summary shown on the packaging step of the route.
  const packagingStepInfo = React.useMemo(() => {
    const boxes = formData.packagingData?.boxes || [];
    if (boxes.length === 0) return "";
    const handed = boxes
      .filter((b) => b.status && b.status !== "ready")
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    return handed > 0
      ? `${boxes.length} quti · omborga ${handed.toLocaleString()}`
      : `${boxes.length} quti`;
  }, [formData.packagingData?.boxes]);

  // Route steps carry UUIDs from the start: the server keeps them on save and journal entries point at them.
  useEffect(() => {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (operations.every((op) => UUID.test(op.id))) return;
    const remap = new Map<string, string>();
    const next = operations.map((op) => {
      if (UUID.test(op.id)) return op;
      const id = crypto.randomUUID();
      remap.set(op.id, id);
      return { ...op, id };
    });
    setOperations(next);
    setShiftEvents((prev) =>
      prev.some((ev) => remap.has(ev.opId)) ? prev.map((ev) => (remap.has(ev.opId) ? { ...ev, opId: remap.get(ev.opId)! } : ev)) : prev
    );
    setSelectedTimelineOpId((cur) => remap.get(cur) || cur);
  }, [operations]);

  // The packaging step mirrors the boxes: packed quantity, and a status from the packing progress.
  // Without boxes the step is left as it is (legacy orders closed before boxes were recorded).
  useEffect(() => {
    const pkg = formData.packagingData;
    const packed = (pkg?.boxes || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    if (packed <= 0 && !pkg?.isCompleted) return;
    const qtyText = `${packed.toLocaleString()} / ${(Number(formData.quantity) || 0).toLocaleString()}`;
    const status: RouteStep["status"] = pkg?.isCompleted ? "Finished" : "In Progress";
    setOperations((prev) => {
      let changed = false;
      const next = prev.map((op) => {
        if (op.kind !== "packaging" || (op.qtyCompleted === qtyText && op.status === status)) return op;
        changed = true;
        return { ...op, qtyCompleted: qtyText, status };
      });
      return changed ? next : prev;
    });
  }, [formData.packagingData, formData.quantity, operations.length]);

  const prevRecipeRef = React.useRef(formData.recipe);

  const [opSelection, setOpSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [editingOpIndex, setEditingOpIndex] = useState<number | null>(null);
  const [opDialogForm, setOpDialogForm] = useState<Omit<RouteStep, "id">>({
    stepNumber: 10,
    name: "",
    machine: formData.pressMachine || "",
    operator: "",
    duration: 1,
    qtyCompleted: `0 / ${formData.quantity || 0}`,
    status: "Queued",
  });

  // Save As Specification State
  const [isSaveSpecDialogOpen, setIsSaveSpecDialogOpen] = useState(false);

  // Shift Timeline & Log Events State
  const [selectedTimelineOpId, setSelectedTimelineOpId] = useState<string>("1");
  const [shiftEvents, setShiftEvents] = useState<ShiftEvent[]>(
    data.events || data.shiftEvents || []
  );
  const [shiftSchedule, setShiftSchedule] = useState<ShiftInterval[]>(DEFAULT_SHIFTS);
  const shiftEventsRef = React.useRef(shiftEvents);
  shiftEventsRef.current = shiftEvents;

  /** The order's number once it exists on the server (journal entries need it). */
  const getSavedOrderNo = () => {
    const no = savedDocNoRef.current || docNo || "";
    return no && !/^(draft-|temp-)/.test(no) && no !== "NEW" && no !== "[Avtomatik]" ? no : "";
  };

  /**
   * Shift journal entries are written to the server the moment they are logged.
   * The local list updates first; on failure it goes back to what it was.
   */
  const persistShiftEvent = async (event: ShiftEvent, previous: ShiftEvent[]) => {
    const orderNo = getSavedOrderNo();
    if (!orderNo) {
      setShiftEvents(previous);
      addNotification({
        title: "Smena jurnaliga yozilmadi",
        description: "Avval buyurtmani saqlang.",
        severity: "error",
      });
      return null;
    }
    const res = await useWorkspaceStore.getState().saveWorkOrderEventAsync(orderNo, event);
    if (!res.success || !res.event) {
      setShiftEvents(previous);
      addNotification({ title: "Smena jurnaliga yozilmadi", description: res.error, severity: "error" });
      return null;
    }
    const saved = res.event;
    setShiftEvents((prev) => prev.map((ev) => (ev.id === saved.id ? saved : ev)));
    return saved;
  };

  /**
   * Brings the journal in line with the server (other tabs and the operator terminal log too);
   * entries that so far lived only in this tab are saved once.
   */
  const syncJournalRef = React.useRef<() => Promise<void>>(async () => {});
  syncJournalRef.current = async () => {
    const orderNo = getSavedOrderNo();
    if (!orderNo) return;
    const store = useWorkspaceStore.getState();
    const res = await store.loadWorkOrderEventsAsync(orderNo);
    if (!res.success) return;
    if (res.schedule && res.schedule.length > 0) setShiftSchedule(res.schedule);
    const serverEvents = res.events || [];
    const known = new Set(serverEvents.map((ev) => ev.id));
    const localOnly = shiftEventsRef.current.filter((ev) => !known.has(ev.id));
    const migrated: ShiftEvent[] = [];
    for (const ev of localOnly) {
      const saved = await store.saveWorkOrderEventAsync(orderNo, ev);
      if (saved.success && saved.event) migrated.push(saved.event);
    }
    setShiftEvents(
      [...migrated, ...serverEvents].sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""))
    );
  };

  // On open, and whenever the user comes back to this window.
  useEffect(() => {
    void syncJournalRef.current();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncJournalRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [docNo]);

  const [isLogEventDialogOpen, setIsLogEventDialogOpen] = useState(false);
  const [isPalletReportDialogOpen, setIsPalletReportDialogOpen] = useState(false);
  const [isDowntimeDialogOpen, setIsDowntimeDialogOpen] = useState(false);
  const [editingPalletEvent, setEditingPalletEvent] = useState<ShiftEvent | null>(null);
  const [editingDowntimeEvent, setEditingDowntimeEvent] = useState<ShiftEvent | null>(null);
  const [logEventForm, setLogEventForm] = useState<{
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC" | "Waste";
    note: string;
    time: string;
    wasteQty?: number;
    wasteReason?: string;
  }>({
    type: "Run",
    note: "",
    time: "15:30",
  });

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPackagingOpen, setIsPackagingOpen] = useState(false);
  const [isTelegramOrdersModalOpen, setIsTelegramOrdersModalOpen] = useState(false);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

  const handleSavePackaging = async (
    summary: WorkOrderPackagingSummary,
    markComplete: boolean,
    handOver: boolean = markComplete
  ) => {
    handleFieldChange("packagingData", summary);

    // Boxes consumed by packaging become a BOM line, unless packaging materials are already listed by hand.
    const boxLineId = "bom-pack-boxes";
    const hasManualPackaging = currentBomItems.some(
      (i) => i.id !== boxLineId && /pack|box|qadoq/i.test(i.category || "")
    );
    let nextMaterials = currentBomItems;
    if (summary.totalBoxes > 0 && !hasManualPackaging) {
      const existingBox = currentBomItems.find((i) => i.id === boxLineId);
      const boxUnitPrice = Number(existingBox?.unitPrice) || 0;
      const boxLine = normalizeBomItem({
        ...existingBox,
        id: boxLineId,
        name: summary.boxType || existingBox?.name || "Karobka",
        spec: `${summary.standardBoxCapacity} dona/quti`,
        category: "Packaging",
        planQty: summary.totalBoxes,
        actualQty: summary.totalBoxes,
        qty: summary.totalBoxes,
        unit: "dona",
        unitPrice: boxUnitPrice,
        totalPrice: Number((summary.totalBoxes * boxUnitPrice).toFixed(2)),
        supplier: existingBox?.supplier || "",
        availability: existingBox?.availability || "In Stock",
      });
      nextMaterials = existingBox
        ? currentBomItems.map((i) => (i.id === boxLineId ? boxLine : i))
        : [...currentBomItems, boxLine];
      setCurrentBomItems(nextMaterials);
      handleFieldChange("materials", nextMaterials);
    }

    const targetWoId = data.docNo || tab.id;
    const isDraftOrder = targetWoId.startsWith("draft-") || targetWoId.startsWith("temp-");
    let nextSummary = summary;

    // Packed boxes go to the FG warehouse as a pending receipt; the warehouse confirms what arrived.
    const readyBoxes = summary.boxes.filter((b) => !b.status || b.status === "ready");
    const readyQty = readyBoxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    if (handOver && readyQty > 0) {
      if (isDraftOrder) {
        addNotification({
          title: "Omborga topshirib bo'lmadi",
          description: "Avval buyurtmani saqlang.",
          severity: "error",
        });
        setTabUnsaved(tab.id, true);
        return;
      }
      // Finished goods are received at their real production cost, not at the selling price.
      const fgCosts = calculateWorkOrderFinancials({
        quantity: Number(formData.quantity) || 0,
        currency: formData.currency || "UZS",
        exchangeRate: Number(formData.exchangeRate) || 12850,
        materials: nextMaterials,
        toolingItems: formData.toolingItems,
        operations,
        shiftEvents,
        machines: storeMachines,
        employees: useWorkspaceStore.getState().employees,
        overheadPercent: formData.financials?.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT,
        packagingData: { ...summary, isCompleted: true },
        materialReturns: getWorkOrderMaterialReturns(
          useWorkspaceStore.getState().warehouseMovements,
          targetWoId
        ),
      });
      const result = await useWorkspaceStore.getState().handOverFinishedGoodsAsync({
        workOrderId: targetWoId,
        orderNo: (data as any).clientOrderId || (formData as any).clientOrderId || null,
        productName: (formData as any).productName || formData.product || (data as any).productName || "Tayyor mahsulot",
        customerName: formData.customer || (data as any).customerName || "Mijoz",
        clientId: (data as any).clientId || null,
        unit: formData.unit || "pcs",
        quantity: readyQty,
        // A hand-entered order cost (manual cost mode) wins over the computed one.
        costPricePerUnit: resolveEffectiveCost(fgCosts, formData.financials).unit,
        boxCount: readyBoxes.length,
      });
      if (!result.success) {
        addNotification({ title: "Omborga topshirib bo'lmadi", description: result.error, severity: "error" });
        setTabUnsaved(tab.id, true);
        return;
      }
      const handedIds = new Set(readyBoxes.map((b) => b.id));
      const now = new Date().toISOString();
      nextSummary = {
        ...summary,
        boxes: summary.boxes.map((b) => (handedIds.has(b.id) ? { ...b, status: "handed" as const, handedOverAt: now } : b)),
      };
      handleFieldChange("packagingData", nextSummary);
      // The hand-over is already on the server: save the order now so the boxes cannot be handed over twice.
      persistAfterRenderRef.current = true;
    }

    // The packaging step itself follows the boxes (see the packaging-step sync effect).
    if (markComplete) {
      if (!isDraftOrder) {
        upsertProductionQueueItem({ id: targetWoId, completedSheets: nextSummary.totalPackedQty });
      }
    }

    addNotification(
      handOver && readyQty > 0
        ? {
            title: markComplete ? "Qadoqlash yakunlandi" : "Omborga topshirildi",
            description: `${readyBoxes.length} ta quti (${readyQty.toLocaleString()} ${formData.unit || "dona"}) ombor qabulini kutmoqda.`,
            severity: "success",
          }
        : markComplete
        ? { title: "Qadoqlash yakunlandi", description: `${summary.totalBoxes} ta quti.`, severity: "success" }
        : { title: "Qadoqlash qoralamasi saqlandi", description: `${summary.totalBoxes} ta quti kiritildi.`, severity: "info" }
    );
    setTabUnsaved(tab.id, true);
  };

  /** Hands the order's packed ("ready") boxes over to the FG warehouse without completing the packaging. */
  const handleHandOverPackaging = (summary?: WorkOrderPackagingSummary) => {
    const current = summary || formData.packagingData;
    if (!current) return;
    void handleSavePackaging(current, false, true);
  };

  // Action: Create Repeat / Reorder Work Order from current order
  const handleReorderWorkOrder = () => {
    const currentDocNo = docNo || data.docNo || tab.id;
    const draftId = `draft-wo-${Date.now()}`;

    openTab({
      id: draftId,
      title: `Yangi: ${formData.product} (Takroriy)`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: buildReorderDocument(
        {
          ...data,
          ...formData,
          operations,
          materials: currentBomItems,
          sampleData,
          skuArtworks,
          attachments: orderAttachments,
        },
        { parentDocNo: currentDocNo, draftId }
      ),
    });

    addNotification({
      title: tOrder("reorderOpenedTitle"),
      description: tOrder("reorderOpenedDesc", { docNo: currentDocNo }),
      severity: "success",
    });
  };


  const handleSelectProductTemplate = (spec: any) => {
    prevRecipeRef.current = spec.code;
    if (!formData.product || formData.product === "Yangi buyruq" || formData.product === "Buyurtma") {
      handleFieldChange("product", spec.name);
    }
    handleFieldChange("recipe", spec.code);
    if (spec.department && spec.department !== formData.department) {
      handleDepartmentChange(spec.department);
    }
    // Load associated BOM materials if defined on the master specification
    const specMaterials = (spec as any).materials;
    if (specMaterials && Array.isArray(specMaterials) && specMaterials.length > 0) {
      const newItems = specMaterials.map(normalizeBomItem);
      setCurrentBomItems(newItems);
      handleFieldChange("materials", newItems);
    }
    // Load technological route operations directly from the specification
    const specOps = buildOperationsFromSpec(
      spec,
      { ...formData, department: spec.department || formData.department },
      tariffs || []
    );
    if (specOps && specOps.length > 0) {
      setOperations(specOps);
      handleFieldChange("operations", specOps);
    }
    setTabUnsaved(tab.id, true);
    addNotification({
      title: "Mahsulot va Texkarta biriktirildi",
      description: `${spec.code}: ${spec.name} retsepti, xomashyo va marshruti buyurtmaga to'liq yuklandi.`,
      severity: "success",
    });
  };

  const handleSaveAsNewSpec = (specData: {
    code: string;
    name: string;
    department: WorkOrderDepartment;
    description: string;
    materials: BomItem[];
    operations: RouteStep[];
  }) => {
    const specId = `SPEC-${specData.department.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const costEstimate = `$${(specData.materials.length * 450).toLocaleString()}`;

    // 1. Persist new spec in workspace store with full material and operation details
    upsertMasterSpecification({
      id: specId,
      code: specData.code,
      name: specData.name,
      department: specData.department,
      description: specData.description,
      materialsCount: specData.materials.length,
      estimatedCost: costEstimate,
      unit: "pcs",
      materials: specData.materials.map((m) => ({
        id: m.id,
        name: m.name,
        quantity: m.actualQty || m.planQty || m.qty || 1,
        unit: m.unit || "pcs",
        spec: m.spec,
        unitPrice: m.unitPrice,
      })),
      operations: specData.operations.map((op) => ({
        id: op.id,
        name: op.name,
        machineStr: op.machine || "",
        durationHours: op.duration,
        operator: op.operator,
        tariffId: op.tariffId,
        tariffCode: op.tariffCode,
        rateUsd: op.rateUsd,
        setupFeeUsd: op.setupFeeUsd,
        pieceworkRateUsd: op.pieceworkRateUsd,
        calcUnit: op.calcUnit,
        unitDivisor: op.unitDivisor,
      })),
    });

    // 2. Automatically link current work order to newly created recipe
    prevRecipeRef.current = specData.code;
    handleFieldChange("recipe", specData.code);
    if (specData.department !== formData.department) {
      handleDepartmentChange(specData.department);
    }
    setTabUnsaved(tab.id, true);

    // 3. Notify user
    addNotification({
      title: "Yangi Spetsifikatsiya yaratildi",
      description: `${specData.code} (${specData.name}) muvaffaqiyatli saqlandi va joriy buyurtmaga bog'landi.`,
      severity: "success",
    });
  };

  const handleOpenParentWorkOrder = (parentDocNo: string) => {
    openTab({
      id: parentDocNo,
      title: `${parentDocNo}: ${formData.product}`,
      type: "work-order",
      module: "production",
      activeLevel3Tab: "overview",
      documentData: {
        docNo: parentDocNo,
        customer: formData.customer,
        product: formData.product,
        status: "Completed",
      },
    });
  };

  // Derived Values
  const { machines: dbMachines, specifications: dbSpecs, sites: dbSites } = useLookupStore();

  const activeSpec = useMemo(
    () =>
      (masterSpecifications || []).find((s) => s.code === formData.recipe || s.id === formData.recipe) ||
      (dbSpecs && dbSpecs.find((s: any) => s.code === formData.recipe || s.id === formData.recipe)),
    [masterSpecifications, dbSpecs, formData.recipe]
  );

  // Synchronize operations when recipe template is changed (e.g. from BOM Shablon biriktirish)
  useEffect(() => {
    if (!formData.recipe) {
      prevRecipeRef.current = "";
      return;
    }
    if (prevRecipeRef.current !== formData.recipe) {
      prevRecipeRef.current = formData.recipe;
      const specOps = buildOperationsFromSpec(activeSpec, formData, tariffs || []);
      setOperations(specOps);
      updateTabData(tab.id, { operations: specOps });
    }
  }, [formData.recipe, activeSpec]);

  // Auto-populate materials and operations from activeSpec on initial load if empty
  const hasAutoPopulatedSpecRef = React.useRef(false);
  useEffect(() => {
    if (hasAutoPopulatedSpecRef.current) return;
    if (activeSpec) {
      let didPopulate = false;
      const specMats = (activeSpec as any).materials;
      if (Array.isArray(specMats) && specMats.length > 0 && (!currentBomItems || currentBomItems.length === 0)) {
        didPopulate = true;
        const loaded = specMats.map(normalizeBomItem);
        setCurrentBomItems(loaded);
        updateTabData(tab.id, { materials: loaded });
      }
      if (!operations || operations.length === 0) {
        didPopulate = true;
        const loadedOps = buildOperationsFromSpec(activeSpec, formData, tariffs || []);
        if (loadedOps.length > 0) {
          setOperations(loadedOps);
          updateTabData(tab.id, { operations: loadedOps });
        }
      }
      if (didPopulate) {
        hasAutoPopulatedSpecRef.current = true;
      }
    }
  }, [activeSpec, currentBomItems, operations, tab.id, updateTabData, formData, tariffs]);
  const activeSite = useMemo(
    () =>
      (plants && plants.find((p: any) => p.id === formData.site || p.name === formData.site)
        ? {
            id: formData.site,
            name: plants.find((p: any) => p.id === formData.site || p.name === formData.site)!.name,
            label: plants.find((p: any) => p.id === formData.site || p.name === formData.site)!.name,
            location: "Asosiy bino",
            facilities: "Ishlab chiqarish",
            status: "Active",
          }
        : null) ||
      (dbSites && dbSites.find((s: any) => s.id === formData.site || s.name === formData.site)) ||
      SITE_OPTIONS.find((s) => s.id === formData.site || s.name === formData.site) || {
        id: formData.site || (plants && plants.length > 0 ? plants[0].id : ""),
        name: (plants && plants.find((p: any) => p.id === formData.site)?.name) || formData.site || "Bosh sex",
        label: (plants && plants.find((p: any) => p.id === formData.site)?.name) || formData.site || "Bosh sex",
        location: "Asosiy bino",
        facilities: "Ishlab chiqarish",
        status: "Active",
      },
    [plants, dbSites, formData.site]
  );
  const activeTech = useMemo(
    () => TECHNOLOGY_OPTIONS.find((t) => t.id === formData.department) || TECHNOLOGY_OPTIONS[0],
    [formData.department]
  );
  const allDbMachines = useMemo(() => {
    if (storeMachines && storeMachines.length > 0) return storeMachines;
    if (dbMachines && dbMachines.length > 0) return dbMachines;
    return [];
  }, [storeMachines, dbMachines]);

  const activeMachine = useMemo(
    () =>
      (allDbMachines && allDbMachines.find((m: any) => m.name === formData.pressMachine || m.code === formData.pressMachine || m.id === formData.pressMachine)) ||
      (formData.pressMachine ? {
        id: "m-custom",
        code: "M-ASSIGNED",
        name: formData.pressMachine,
        department: formData.department,
        speed: "Standart",
        format: "Standart",
        features: "Maxsus uskuna",
        status: "Running",
        isAvailable: true,
      } : undefined),
    [allDbMachines, formData.pressMachine, formData.department]
  );
  const currentDeptMachines = useMemo(
    () => {
      const fromDb = (allDbMachines || []).filter((m: any) => {
        if (!m.department) return false;
        const md = m.department.toLowerCase();
        if (md === formData.department.toLowerCase()) return true;
        if (formData.department === "Termo" && (md.includes("post") || md.includes("pardoz") || md.includes("kesish"))) return true;
        return false;
      });
      if (fromDb.length > 0) return fromDb;
      return allDbMachines;
    },
    [allDbMachines, formData.department]
  );

  const currentRecipeMaterials = useMemo(() => {
    if (currentBomItems && currentBomItems.length > 0) {
      return currentBomItems.map((item) => {
        const req = item.actualQty !== undefined ? Number(item.actualQty) : Number(item.qty || 0);
        const isClient = item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz");
        const matchedStock = warehouseStock.find(
          (ws) =>
            ws.sku.toLowerCase() === (item.id || "").toLowerCase() ||
            ws.name.toLowerCase() === (item.name || "").toLowerCase()
        );
        const stock = isClient
          ? req
          : matchedStock
          ? matchedStock.available
          : item.warehouseAvailable !== undefined
          ? Number(item.warehouseAvailable)
          : item.availability === "On Order"
          ? 0
          : req;
        return {
          code: item.id,
          name: item.name,
          req,
          stock,
          unit: item.unit || "dona",
          costPerUnit: Number(item.unitPrice || 0),
        };
      });
    }
    return RECIPE_MATERIALS[formData.recipe] || [];
  }, [currentBomItems, warehouseStock, formData.recipe]);

  const hasShortage = useMemo(
    () => currentRecipeMaterials.some((m) => m.req > m.stock),
    [currentRecipeMaterials]
  );

  const deadlineCountdown = useMemo(() => {
    if (!formData.deadline) return null;
    try {
      const target = new Date(formData.deadline).getTime();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
      return isNaN(diffDays) ? null : diffDays;
    } catch {
      return null;
    }
  }, [formData.deadline]);

  const selectedOp = useMemo(() => {
    return operations.find((op) => op.id === selectedTimelineOpId) || operations[0] || {
      id: "",
      stepNumber: 0,
      name: "Operatsiya kiritilmagan",
      machine: formData.pressMachine || "—",
      operator: "—",
      duration: 0,
      qtyCompleted: "0 / 0",
      status: "Queued" as const,
    };
  }, [operations, selectedTimelineOpId, formData.pressMachine]);

  const selectedOpEvents = useMemo(() => {
    return shiftEvents.filter((ev) => ev.opId === selectedOp.id);
  }, [shiftEvents, selectedOp.id]);

  // Synchronize paperReady gate status based on BOM items stock availability
  const syncPaperReadiness = useCallback(
    (bomList: BomItem[]) => {
      const targetId = data.docNo || tab.id;
      const currentQueueItem = useWorkspaceStore.getState().productionQueue.find((q) => {
        const key = (targetId || "").trim().toLowerCase();
        return q.id?.toLowerCase() === key || (q.docNo && q.docNo.toLowerCase() === key);
      });
      const paperAudit = currentQueueItem?.checks?.audit?.paperReady || (formData.checks as any)?.audit?.paperReady;
      if (paperAudit?.verifiedBy) {
        // Inson tomonidan qo'lda tasdiqlangan (Manual Override) - ustidan yozmaslik!
        return;
      }

      if (!bomList || bomList.length === 0) {
        const paperReady = false;
        if (toggleReadinessCheck && !targetId.startsWith("draft-") && !targetId.startsWith("temp-")) {
          toggleReadinessCheck(targetId, "paperReady", {
            forceStatus: "pending",
          });
        }
        const currentChecks = (formData as any).checks || {};
        if (currentChecks.paperReady !== paperReady) {
          const updatedChecks = { ...currentChecks, paperReady };
          setFormData((prev) => ({ ...prev, checks: updatedChecks }));
          updateTabData(tab.id, { checks: updatedChecks });
        }
        return;
      }

      const wsStock = useWorkspaceStore.getState().warehouseStock;
      const hasShortage = bomList.some((item) => {
        if (item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz")) {
          return false;
        }
        if (item.availability === "On Order") {
          return true;
        }
        const matched = wsStock.find(
          (ws) =>
            ws.sku.toLowerCase() === item.id.toLowerCase() ||
            ws.name.toLowerCase() === item.name.toLowerCase()
        );
        if (matched) {
          const required = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
          return required > matched.available;
        }
        return false;
      });

      const paperReady = !hasShortage;
      if (toggleReadinessCheck && !targetId.startsWith("draft-") && !targetId.startsWith("temp-")) {
        toggleReadinessCheck(targetId, "paperReady", {
          forceStatus: paperReady ? "ready" : "pending",
        });
      }
      const currentChecks = (formData as any).checks || {};
      if (currentChecks.paperReady !== paperReady) {
        const updatedChecks = { ...currentChecks, paperReady };
        setFormData((prev) => ({ ...prev, checks: updatedChecks }));
        updateTabData(tab.id, { checks: updatedChecks });
      }
    },
    [data.docNo, tab.id, toggleReadinessCheck, formData.checks, updateTabData]
  );

  // Initial paperReady check on mount
  useEffect(() => {
    if (currentBomItems && currentBomItems.length > 0) {
      syncPaperReadiness(currentBomItems);
    }
  }, []);

  // Actions
  const handleFieldChange = (field: string | Record<string, any>, val?: any) => {
    const updates: Record<string, any> = typeof field === "string" ? { [field]: val } : field;

    if ("status" in updates) {
      const nextStatus = updates.status;
      if (nextStatus === "Completed" && !updates.actualEndDate && !formData.actualEndDate) {
        updates.actualEndDate = new Date().toISOString().split("T")[0];
      } else if (nextStatus !== "Completed" && formData.status === "Completed" && !("actualEndDate" in updates)) {
        updates.actualEndDate = "";
      }
    }

    // Takroriy buyurtma qoralamasida tiraj o'zgarsa, asl buyurtmaning dona narxi saqlanadi:
    // "Umumiy summa" eski tiraj uchun qolib ketmasligi kerak.
    if ("quantity" in updates && !("priceTotal" in updates) && formData.isReorder && formData.status === "Draft") {
      const oldQty = Number(formData.quantity) || 0;
      const newQty = Number(updates.quantity) || 0;
      const oldTotal = Number(formData.priceTotal) || 0;
      if (oldQty > 0 && newQty > 0 && oldTotal > 0) {
        const decimals = (formData.currency || "UZS") === "UZS" ? 0 : 2;
        updates.priceTotal = Number(((oldTotal / oldQty) * newQty).toFixed(decimals));
      }
    }

    // Kashirovka layers print what the order prints: face liner = front, back liner = reverse
    if (["frontColors", "backColors", "spotColorItems", "colorsConfig", "kashirovkaLayers", "kashirovkaMode"].some((f) => f in updates)) {
      const merged = { ...formData, ...updates };
      const synced = syncKashirovkaLayerColors(
        merged.kashirovkaLayers,
        merged.frontColors,
        merged.backColors,
        merged.spotColorItems,
        merged.colorsConfig
      );
      if (synced !== merged.kashirovkaLayers) updates.kashirovkaLayers = synced;
    }

    setFormErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      Object.keys(updates).forEach((k) => {
        if (k in next) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    const shouldSyncBom = Object.keys(updates).some((f) =>
      [
        "paperStock",
        "lamination",
        "laminationSides",
        "laminationMicron",
        "laminationStockSku",
        "coating",
        "coatingStockSku",
        "coatingZone",
        "embellishment",
        "embellishmentStockSku",
        "embellishmentZone",
        "quantity",
        "plannedSheets",
        "parentSheetW",
        "parentSheetH",
      ].includes(f)
    );

    const shouldSyncOperations =
      !updates.operations &&
      Object.keys(updates).some((f) =>
        [
          "quantity",
          "plannedSheets",
          "toolingItems",
          "kashirovkaMode",
          "kashirovkaStrategy",
          "kashirovkaLayers",
        ].includes(f)
      );

    const nextForm = { ...formData, ...updates };
    setFormData((prev) => ({ ...prev, ...updates }));

    let nextOps = operations;
    if (shouldSyncOperations && operations.length > 0) {
      nextOps = recalculateRouteStepsForOrder(operations, nextForm, tariffs || []);
      setOperations(nextOps);
    }

    if (shouldSyncBom) {
      const synced = syncBomWithSpecs(currentBomItems, nextForm, warehouseStock);
      setCurrentBomItems(synced);
      updateTabData(tab.id, {
        ...updates,
        materials: synced,
        ...(shouldSyncOperations ? { operations: nextOps } : {}),
      });
      syncPaperReadiness(synced);
    } else {
      updateTabData(tab.id, {
        ...updates,
        ...(shouldSyncOperations ? { operations: nextOps } : {}),
      });
    }

    setTabUnsaved(tab.id, true);
  };

  const handleSizesChange = (newSizes: SizeDistribution[]) => {
    const total = newSizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const updates = {
      sizes: newSizes,
      ...(newSizes.length > 0 && total > 0 ? { quantity: total } : {}),
    };
    const updatedForm = { ...formData, ...updates };
    setFormData((prev) => ({ ...prev, ...updates }));
    updateTabData(tab.id, updates);
    setTabUnsaved(tab.id, true);

    if (newSizes.length > 0) {
      const synced = syncBomWithSpecs(currentBomItems, updatedForm, warehouseStock);
      setCurrentBomItems(synced);
      const nextOps =
        operations.length > 0
          ? recalculateRouteStepsForOrder(operations, updatedForm, tariffs || [])
          : operations;
      if (operations.length > 0) {
        setOperations(nextOps);
      }
      updateTabData(tab.id, { materials: synced, operations: nextOps });
      syncPaperReadiness(synced);
    }
  };

  const handleDepartmentChange = (newDept: string) => {
    const available = MACHINE_MAP[newDept] || [];
    const defaultMachine = available[0] || formData.pressMachine;
    setFormData((prev) => ({
      ...prev,
      department: newDept as any,
      pressMachine: defaultMachine,
    }));
    updateTabData(tab.id, {
      department: newDept,
      pressMachine: defaultMachine,
    });
    setTabUnsaved(tab.id, true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const customer = (formData.customer || "").trim();
    const product = (formData.product || "").trim();
    const quantity = Number(formData.quantity) || 0;

    if (!customer) {
      newErrors.customer = tOrder("errorCustomerRequired");
    }
    if (!product) {
      newErrors.product = tOrder("errorProductRequired");
    }
    if (quantity <= 0) {
      newErrors.quantity = tOrder("errorQuantityPositive");
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      if (activeTab !== "overview") {
        setLevel3Tab(tab.id, "overview");
      }
      setTimeout(() => {
        if (newErrors.customer) {
          const el = document.getElementById("wo-input-customer");
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus();
        } else if (newErrors.product) {
          const el = document.getElementById("wo-input-product");
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus();
        } else if (newErrors.quantity) {
          const el = document.getElementById("wo-input-quantity");
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus();
        }
      }, 100);

      addNotification({
        title: tOrder("fillRequiredTitle"),
        description: tOrder("fillRequiredDesc"),
        severity: "error",
      });
      return false;
    }

    setFormErrors({});
    return true;
  };

  const persistOrderDetails = async (): Promise<string> => {
    if (!validateForm()) {
      return "";
    }
    // If a save operation is already in flight, return existing doc ID to avoid duplicates
    if (isSavingRef.current) {
      return savedDocNoRef.current || docNo || tab.id;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      let currentDocNo = savedDocNoRef.current || docNo;
      const hasRealDocNo = Boolean(
        currentDocNo &&
        !currentDocNo.startsWith("draft-") &&
        !currentDocNo.startsWith("temp-") &&
        currentDocNo !== "NEW" &&
        currentDocNo !== "[Avtomatik]"
      );
      const isCurrentlyDraft = !hasRealDocNo;

      const queueItem = useWorkspaceStore.getState().productionQueue.find((i) => {
        const matchKey = (currentDocNo || tab.id).toLowerCase();
        return i.id.toLowerCase() === matchKey || (i.docNo && i.docNo.toLowerCase() === matchKey);
      });
      const currentChecks = queueItem?.checks || formData.checks;
      const currentStage =
        queueItem?.stage ||
        formData.stage ||
        (formData.status === "In Production" ? "In Production" : "Queue");

      if (upsertWorkOrderAsync) {
        const savedResult = await upsertWorkOrderAsync({
          ...formData,
          stage: currentStage as any,
          checks: currentChecks,
          docNo: isCurrentlyDraft ? undefined : currentDocNo,
          operations,
          sampleData,
          attachments: orderAttachments,
          skuArtworks,
          materials: currentBomItems,
        });

        if (!savedResult || savedResult.success === false) {
          addNotification({
            title: "Saqlashda xatolik",
            description: savedResult?.error || "Buyurtmani saqlashda xatolik yuz berdi.",
            severity: "error",
          });
          return "";
        }

        const realDocNo = savedResult.docNo || savedResult.workOrder?.docNo;
        if (realDocNo) {
          currentDocNo = realDocNo;
          savedDocNoRef.current = currentDocNo;
          setDocNo(currentDocNo);

          // Clean legacy draft-wo-* prefixes in tooling and BOM items
          const cleanItemName = (name: string) =>
            name ? name.replace(/draft-wo-\d+|temp-[\w-]+/g, realDocNo) : name;

          if (formData.toolingItems && formData.toolingItems.length > 0) {
            const updatedTooling = formData.toolingItems.map((tool) => ({
              ...tool,
              name: cleanItemName(tool.name),
            }));
            formData.toolingItems = updatedTooling;
            handleFieldChange("toolingItems", updatedTooling);
          }

          if (currentBomItems && currentBomItems.length > 0) {
            const updatedBom = currentBomItems.map((mat) => ({
              ...mat,
              name: cleanItemName(mat.name),
            }));
            setCurrentBomItems(updatedBom);
            handleFieldChange("materials", updatedBom);
          }

          if (isCurrentlyDraft || tab.id.startsWith("draft-") || tab.id.startsWith("temp-") || tab.id !== currentDocNo) {
            replaceTabId(
              tab.id,
              currentDocNo,
              `${currentDocNo}: ${formData.product || "Yangi buyruq"}`,
              {
                ...data,
                ...formData,
                docNo: currentDocNo,
              }
            );
          }
        }
      }

      const effectiveId = currentDocNo || tab.id;

      updateTabData(
        effectiveId,
        {
          ...data,
          ...formData,
          operations,
          shiftEvents,
          docNo: currentDocNo,
          sampleData,
          sampleQty: sampleData.sampleQty,
          sampleRequired: formData.orderType === "Sample",
          sampleApprovalStatus: sampleData.approvalStatus,
          sampleTestPurpose: sampleData.testPurpose,
          sampleTestMachine: sampleData.testMachine,
          sampleProduced: sampleData.isProduced,
          sampleQcPassed: sampleData.qcPassed,
          sampleRevisions: sampleData.revisions,
          attachments: orderAttachments,
          skuArtworks,
        },
        `${effectiveId}: ${formData.product || "Yangi buyruq"}`
      );

      const isSampleNeeded = formData.orderType === "Sample" || Boolean(sampleData?.isRequired);

      upsertProductionQueueItem({
        ...formData,
        id: effectiveId,
        docNo: effectiveId,
        checks: currentChecks,
        stage: currentStage as any,
        customer: formData.customer,
        product: formData.product,
        quantity:
          formData.orderType === "Sample" && sampleData.approvalStatus !== "approved"
            ? sampleData.sampleQty
            : formData.quantity,
        unit: formData.unit,
        pressMachine: formData.pressMachine,
        department: formData.department,
        priority: (formData.priority as "Normal" | "High" | "Urgent") || "Normal",
        orderDate: formData.orderDate,
        deadline: formData.deadline,
        actualEndDate: formData.actualEndDate,
        orderType: formData.orderType,
        sampleRequired: isSampleNeeded,
        sampleStatus: isSampleNeeded
          ? sampleData.approvalStatus === "approved"
            ? "approved"
            : sampleData.approvalStatus === "revision_requested"
            ? "revision_requested"
            : sampleData.isProduced
            ? "awaiting_approval"
            : "in_production"
          : "none",
        sampleQty: sampleData.sampleQty,
        sampleData,
        operations,
        attachments: orderAttachments,
        skuArtworks,
      });

      setTabUnsaved(effectiveId, false);
      return effectiveId;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };
  persistOrderDetailsRef.current = persistOrderDetails;

  // After a save the server has re-derived the steps from the journal: refresh this tab's copy.
  const wasSavingRef = React.useRef(false);
  useEffect(() => {
    if (wasSavingRef.current && !isSaving) void syncJournalRef.current();
    wasSavingRef.current = isSaving;
  }, [isSaving]);

  // Saves the order once the hand-over state has rendered (the save reads the current form data).
  React.useEffect(() => {
    if (!persistAfterRenderRef.current) return;
    persistAfterRenderRef.current = false;
    void persistOrderDetailsRef.current?.();
  }, [formData.packagingData]);

  const handleSave = async () => {
    if (isSavingRef.current) return;
    const savedId = await persistOrderDetails();
    if (!savedId) return;
    setHistoryRefreshTrigger((prev) => prev + 1);
    addNotification({
      title: tOrder("orderSavedTitle"),
      description: tOrder("orderSavedDesc", { docNo: savedId, product: formData.product || tShell("untitledOrder") }),
      severity: "success",
    });
  };

  const handleSaveAndClose = async () => {
    if (isSavingRef.current) return;
    try {
      const savedId = await persistOrderDetails();
      if (!savedId) return;

      const targetDocId = savedId || savedDocNoRef.current || tab.id;

      setTabUnsaved(tab.id, false);
      if (targetDocId && targetDocId !== tab.id) {
        setTabUnsaved(targetDocId, false);
      }

      addNotification({
        title: tOrder("orderSavedTitle"),
        description: tOrder("orderSavedDesc", { docNo: targetDocId, product: formData.product || tShell("untitledOrder") }),
        severity: "success",
      });

      closeTab(tab.id);
      if (targetDocId && targetDocId !== tab.id) {
        closeTab(targetDocId);
      }
    } catch (err) {
      console.error("handleSaveAndClose error:", err);
    }
  };

  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleSaveAndCloseRef = React.useRef(handleSaveAndClose);
  handleSaveAndCloseRef.current = handleSaveAndClose;

  // Listen for Save and Close event from Workspace confirmation modal
  React.useEffect(() => {
    const handleSaveAndCloseEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId: string }>).detail;
      if (detail?.tabId === tab.id || detail?.tabId === savedDocNoRef.current) {
        handleSaveAndCloseRef.current();
      }
    };
    window.addEventListener("printgo:save-and-close", handleSaveAndCloseEvent);
    return () => window.removeEventListener("printgo:save-and-close", handleSaveAndCloseEvent);
  }, [tab.id]);

  // Listen for global Ctrl+S / Cmd+S save event
  React.useEffect(() => {
    const handleShortcutSaveEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId: string }>).detail;
      if (detail?.tabId === tab.id || detail?.tabId === savedDocNoRef.current) {
        handleSaveRef.current();
      }
    };
    window.addEventListener("printgo:shortcut-save", handleShortcutSaveEvent);
    return () => window.removeEventListener("printgo:shortcut-save", handleShortcutSaveEvent);
  }, [tab.id]);

  // Prevent accidental browser tab close / refresh when unsaved
  React.useEffect(() => {
    if (!tab.isUnsaved) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tab.isUnsaved]);

  const totalShiftWasteSheets = useMemo(() => {
    return shiftEvents.reduce((acc, ev) => acc + (Number(ev.wasteQty) || 0), 0);
  }, [shiftEvents]);

  const handleOpenMaterialIssueTab = useCallback((targetDocNo: string) => {
    openTab({
      id: targetDocNo,
      type: "warehouse-movement",
      title: targetDocNo,
      module: "WAREHOUSE",
      documentData: { docNo: targetDocNo },
    });
  }, [openTab]);

  const handleExecuteSpisanie = useCallback(async (customItems?: BomItem[]) => {
    const { consumeMaterialsForWorkOrder, employees } = useWorkspaceStore.getState();

    if (formData.materialsConsumed) {
      addNotification({
        title: "Xomashyo allaqachon hisobdan chiqarilgan",
        description: `Chiqim hujjati: ${formData.materialIssueDocNo}`,
        severity: "info",
      });
      return;
    }

    const itemsToConsume = customItems || currentBomItems;
    if (!itemsToConsume || itemsToConsume.length === 0) {
      addNotification({
        title: "Xomashyo topilmadi",
        description: "BOM jadvalida hisobdan chiqarish uchun material mavjud emas.",
        severity: "warning",
      });
      return;
    }

    const currentDocNo = docNo || data.docNo || tab.id;

    const preparedItems: BomItem[] = itemsToConsume.map((item, idx) => {
      let actual = Number(item.actualQty);
      const plan = Number(item.planQty) || Number(item.qty) || 0;
      if (isNaN(actual) || actual <= 0) {
        actual = plan;
      }
      const isSubstrate = idx === 0 || item.category === "Paper & Board" || item.category === "Roll & Label";
      let waste = Number(item.wasteQty) || 0;
      if (isSubstrate && totalShiftWasteSheets > 0 && actual === plan) {
        actual += totalShiftWasteSheets;
        waste = totalShiftWasteSheets;
      } else if (actual > plan && waste === 0) {
        waste = actual - plan;
      }

      return {
        ...item,
        planQty: plan,
        actualQty: actual,
        wasteQty: waste,
      };
    });

    const movement = await consumeMaterialsForWorkOrder({
      workOrderId: currentDocNo,
      orderNumber: currentDocNo,
      customer: formData.customer,
      pressMachine: formData.pressMachine,
      operator: employees[0]?.fullName || "",
      reason: `Ishlab chiqarishga sarf (Spisanie) — ${currentDocNo} (${formData.product})`,
      items: preparedItems,
    });
    // Ombor hujjati o'tmagan bo'lsa (qoldiq yetarli emas, material katalogda yo'q) — buyurtma o'zgarmaydi
    if (!movement) return;

    const now = new Date().toISOString();
    const updates = {
      materials: preparedItems,
      materialsConsumed: true,
      materialsConsumedAt: now,
      materialIssueDocNo: movement.id,
    };

    setCurrentBomItems(preparedItems);
    setFormData((prev) => ({ ...prev, ...updates }));
    updateTabData(tab.id, updates);

    // Auto-save Work Order immediately to database so that materials and issueDocNo are NEVER lost
    try {
      if (persistOrderDetailsRef.current) {
        await persistOrderDetailsRef.current();
      }
    } catch (err) {
      console.error("Failed to auto-save work order on spisanie:", err);
    }

    addNotification({
      title: "Xomashyo hisobdan chiqarildi va saqlandi",
      description: `${movement.id} hujjati yaratildi va ish hujjati avtomatik saqlandi.`,
      severity: "success",
    });

    return movement;
  }, [
    formData.materialsConsumed,
    formData.materialIssueDocNo,
    formData.customer,
    formData.pressMachine,
    formData.product,
    currentBomItems,
    totalShiftWasteSheets,
    docNo,
    data.docNo,
    tab.id,
    addNotification,
    setFormData,
    updateTabData,
  ]);

  const handleCreateShipmentForBatch = useCallback(
    async (batch: WorkOrderDeliveryBatch) => {
      const { upsertWarehouseShipmentAsync, loadFinishedGoods } = useWorkspaceStore.getState();
      const currentDocNo = docNo || data.docNo || tab.id;

      // A batch ships only what the FG warehouse has received for this order (minus other reservations).
      await loadFinishedGoods?.();
      const fg = useWorkspaceStore
        .getState()
        .finishedGoods.find((f) => f.workOrderId === currentDocNo && f.id === `FG-${currentDocNo}`);
      const freeQty = fg ? Math.max(0, Number(fg.stockQty) || 0) : 0;
      if (freeQty <= 0) {
        addNotification({
          title: "Omborda tayyor mahsulot yo'q",
          description: "Avval qadoqlangan qutilarni omborga topshiring va ombor qabulini tasdiqlating.",
          severity: "error",
        });
        return;
      }
      const qty = Math.min(Number(batch.quantity) || 0, freeQty);

      // Raqamni server (numberingService: SHP-YY-NNNN) beradi
      const shipmentData = {
        id: "",
        shipmentNumber: "",
        shipmentType: "CustomerDelivery",
        clientId: (data as any).clientId || undefined,
        date: new Date().toISOString().split("T")[0],
        status: "Draft",
        customerName: formData.customer,
        workOrderId: currentDocNo,
        workOrder: currentDocNo,
        batchId: batch.id,
        batchNo: String(batch.batchNo),
        quantity: qty,
        unit: formData.unit || "dona",
        notes: `Work Order ${currentDocNo} — Partiya #${batch.batchNo} (${qty.toLocaleString()} ${formData.unit || "dona"})`,
        items: [
          {
            id: `item-${Date.now()}`,
            sku: `FG-${currentDocNo}`,
            finishedGoodId: fg?.dbId,
            sourceWorkOrderId: currentDocNo,
            accountCode: "2810",
            name: formData.product,
            quantity: qty,
            unit: formData.unit || "dona",
            unitPrice: Number(formData.quantity) > 0 ? Number(((Number(formData.priceTotal) || 0) / Number(formData.quantity)).toFixed(4)) : 0,
            totalPrice: Number((qty * (Number(formData.quantity) > 0 ? (Number(formData.priceTotal) || 0) / Number(formData.quantity) : 0)).toFixed(2)),
          },
        ],
      };

      const saved = upsertWarehouseShipmentAsync ? await upsertWarehouseShipmentAsync(shipmentData) : null;
      if (!saved?.success || !saved.shipmentNumber) {
        addNotification({
          title: "Chiqim yaratilmadi",
          description: saved?.error || "Serverda xatolik yuz berdi.",
          severity: "error",
        });
        return;
      }
      const newShipmentId = saved.shipmentNumber;

      // Chiqim hali qoralama: partiya "ready" bo'ladi; "dispatched" faqat ombor chiqarganda qo'yiladi
      // The batch may be brand new (whole order shipped as one batch): add it before linking.
      const known = formData.deliveryBatches || [];
      const currentBatches = known.some((b) => b.id === batch.id) ? known : [...known, batch];
      const updatedBatches = currentBatches.map((b) =>
        b.id === batch.id
          ? {
              ...b,
              linkedShipmentId: newShipmentId,
              linkedShipmentNo: newShipmentId,
              status: "ready" as const,
            }
          : b
      );
      handleFieldChange("deliveryBatches", updatedBatches);
      setTabUnsaved(tab.id, true);

      openTab({
        id: newShipmentId,
        title: `${newShipmentId}: Chiqim`,
        type: "warehouse-shipment",
        module: "warehouse",
        isUnsaved: false,
        documentData: { ...shipmentData, id: newShipmentId, shipmentNumber: newShipmentId, customer: formData.customer },
      });

      addNotification({
        title: "Chiqim hujjati yaratildi",
        description: `${newShipmentId} shakllantirildi.`,
        severity: "success",
      });
    },
    [docNo, data.docNo, tab.id, formData, handleFieldChange, setTabUnsaved, openTab, addNotification]
  );

  const handleOpenShipmentTab = useCallback(
    (shipmentId: string) => {
      const existing = (useWorkspaceStore.getState().warehouseShipments || []).find(
        (s) => s.id === shipmentId || (s as any).shipmentNumber === shipmentId || (s as any).docNo === shipmentId
      );
      openTab({
        id: shipmentId,
        title: `${shipmentId}: Chiqim`,
        type: "warehouse-shipment",
        module: "warehouse",
        documentData: existing || { id: shipmentId, shipmentNumber: shipmentId },
      });
    },
    [openTab]
  );

  const handleOpenDeliveryActTab = useCallback(
    (actId: string) => {
      openTab({
        id: actId,
        title: `${actId}: Dalolatnoma`,
        type: "delivery-act",
        module: "finance",
        documentData: { id: actId },
      });
    },
    [openTab]
  );

  const activePrintPlan = React.useMemo(
    () =>
      calculatePrintPlanning({
        targetQuantity: Number(formData.quantity) || 0,
        piecesPerSheet: formData.sizes && formData.sizes.length > 0 ? formData.sizes.length : 10,
        frontColors: formData.frontColors || { c: true, m: true, y: true, k: true },
        backColors: formData.backColors || { c: false, m: false, y: false, k: false },
        spotColors: formData.spotColorItems || [],
        printMethod: formData.printMethod,
        parentSheetW: formData.parentSheetW || 1000,
        parentSheetH: formData.parentSheetH || 700,
        pressSheetW: formData.pressSheetW || 500,
        pressSheetH: formData.pressSheetH || 700,
        kashirovkaPlates: kashirovkaPlatesPerForm(
          formData.kashirovkaMode,
          formData.kashirovkaLayers,
          formData.kashirovkaStrategy
        ),
      }),
    [
      formData.quantity,
      formData.sizes,
      formData.kashirovkaMode,
      formData.kashirovkaLayers,
      formData.kashirovkaStrategy,
      formData.frontColors,
      formData.backColors,
      formData.spotColorItems,
      formData.printMethod,
      formData.parentSheetW,
      formData.parentSheetH,
      formData.pressSheetW,
      formData.pressSheetH,
    ]
  );

  /** How a step counts its output: unit, report container, pieces per unit (from the spec and its machine). */
  const profileOf = useCallback(
    (op: RouteStep) => {
      const machine = resolveMachine(op, storeMachines);
      const ups = Number(formData.impositionState?.summary?.itemsPerSheet) || activePrintPlan.piecesPerSheet;
      return getCountingProfile({
        machineCategory: machine?.category,
        machineDepartment: machine?.department,
        orderDepartment: formData.department,
        widthMm: Number(formData.width) || 0,
        heightMm: Number(formData.height) || 0,
        gapYMm: formData.flexoGapY ?? 3,
        lanes: formData.flexoLanes ?? 1,
        itemsPerSheet: ups,
      });
    },
    [
      storeMachines,
      formData.impositionState,
      formData.department,
      formData.width,
      formData.height,
      formData.flexoGapY,
      formData.flexoLanes,
      activePrintPlan.piecesPerSheet,
    ]
  );

  const [isJobTicketOpen, setIsJobTicketOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsJobTicketOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Operation Dialog Handlers
  // Route money fields are stored in USD (see financialsEngine / OperationsTab), but the
  // dialog edits them in the order currency. Convert at the dialog boundary.
  const opDialogFx =
    (formData.currency || "UZS").toUpperCase() === "USD" ? 1 : Number(formData.exchangeRate) || 12850;
  const convertOpMoney = <T extends Partial<RouteStep>>(op: T, factor: number): T => ({
    ...op,
    rateUsd: Number(((Number(op.rateUsd) || 0) * factor).toFixed(6)),
    setupFeeUsd: Number(((Number(op.setupFeeUsd) || 0) * factor).toFixed(6)),
    pieceworkRateUsd: Number(((Number(op.pieceworkRateUsd) || 0) * factor).toFixed(6)),
    plannedCostUsd: Number(((Number(op.plannedCostUsd) || 0) * factor).toFixed(6)),
    pieceworkTotalUsd: Number(((Number(op.pieceworkTotalUsd) || 0) * factor).toFixed(6)),
    manualCostUsd: Number(((Number(op.manualCostUsd) || 0) * factor).toFixed(6)),
  });

  const handleOpenAddOperation = () => {
    setEditingOpIndex(null);
    // A new step goes after the last production step; packaging always stays the final step.
    const nextStepNum = (operations.filter((op) => op.kind !== "packaging").length + 1) * 10;
    setOpDialogForm({
      stepNumber: nextStepNum,
      name: "",
      machine: formData.pressMachine || "",
      operator: "",
      operators: [],
      duration: 1,
      qtyCompleted: `0 / ${(formData.quantity || 5000).toLocaleString()}`,
      status: "Queued",
      tariffId: undefined,
      tariffCode: undefined,
      calcUnit: "1,000 sheets",
      unitDivisor: 1000,
      rateUsd: 0,
      setupFeeUsd: 0,
      pieceworkRateUsd: 0,
      plannedCostUsd: 0,
      pieceworkTotalUsd: 0,
      costMode: "auto",
      manualCostUsd: 0,
    });
    setIsOpDialogOpen(true);
  };

  const handleOpenEditOperation = (index: number) => {
    const item = operations[index];
    if (!item) return;
    setEditingOpIndex(index);
    setOpDialogForm({
      stepNumber: item.stepNumber,
      name: item.name,
      machine: item.machine,
      machineId: item.machineId,
      costMode: item.costMode || "auto",
      costNote: item.costNote,
      operator: item.operator,
      operators:
        item.operators && item.operators.length > 0
          ? item.operators
          : item.operator
          ? item.operator.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      duration: item.duration,
      qtyCompleted: item.qtyCompleted,
      status: item.status,
      toolingId: item.toolingId,
      toolingName: item.toolingName,
      tariffId: item.tariffId,
      tariffCode: item.tariffCode,
      workRateId: item.workRateId,
      actualDurationMinutes: item.actualDurationMinutes,
      calcUnit: item.calcUnit,
      unitDivisor: item.unitDivisor,
      ...convertOpMoney(
        {
          rateUsd: item.rateUsd,
          setupFeeUsd: item.setupFeeUsd,
          pieceworkRateUsd: item.pieceworkRateUsd,
          plannedCostUsd: item.plannedCostUsd,
          pieceworkTotalUsd: item.pieceworkTotalUsd,
          manualCostUsd: item.manualCostUsd,
        },
        opDialogFx
      ),
    });
    setIsOpDialogOpen(true);
  };

  const handleSaveOperationDialog = () => {
    const savedForm = convertOpMoney(opDialogForm, 1 / opDialogFx);
    const editing = editingOpIndex !== null ? operations[editingOpIndex] : undefined;
    const step: RouteStep = editing ? { ...editing, ...savedForm } : { id: String(Date.now()), ...savedForm };
    const nextOps = placeRouteStep(
      operations.filter((op) => op !== editing),
      step,
      editing?.stepNumber
    );
    setOperations(nextOps);
    updateTabData(tab.id, { operations: nextOps });
    setTabUnsaved(tab.id, true);
    setIsOpDialogOpen(false);
  };

  const handleDeleteSelectedOperation = () => {
    const selectedRows = opSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = operations
      .filter((op, idx) => !selectedRows.includes(idx) || op.kind === "packaging")
      .map((op, idx) => ({
        ...op,
        stepNumber: (idx + 1) * 10,
      }));
    setOperations(remaining);

    // If a recipe template was active and operation(s) are deleted from it, detach the recipe
    if (formData.recipe) {
      prevRecipeRef.current = "";
      setFormData((prev) => ({ ...prev, recipe: "" }));
      updateTabData(tab.id, { recipe: "", operations: remaining });
    } else {
      updateTabData(tab.id, { operations: remaining });
    }

    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // Log Event Dialog Handlers
  const handleOpenLogEvent = () => {
    setEditingPalletEvent(null);
    setIsPalletReportDialogOpen(true);
  };

  const handleOpenEditPalletEvent = (event: ShiftEvent) => {
    setEditingPalletEvent(event);
    setIsPalletReportDialogOpen(true);
  };

  const askDialog = useAskDialog();

  // ── Step state machine: every transition is a journal entry; the step's fields follow the journal ──
  const [downtimeDialogMode, setDowntimeDialogMode] = useState<"open" | "record">("open");

  const stepEventsOf = (opId: string, events: ShiftEvent[] = shiftEventsRef.current) =>
    events.filter((ev) => ev.opId === opId);

  const logStepTransition = (opId: string, type: ShiftEvent["type"], note = "", extra: Partial<ShiftEvent> = {}) => {
    const previous = shiftEventsRef.current;
    const at = new Date();
    const event: ShiftEvent = {
      id: `e_${type}_${at.getTime()}`,
      opId,
      type,
      time: plantClock(at).time,
      occurredAt: at.toISOString(),
      note,
      operator: "",
      ...extra,
    };
    setShiftEvents([event, ...previous]);
    void persistShiftEvent(event, previous);
    setTabUnsaved(tab.id, true);
  };

  /**
   * A step starts only after the previous production step has produced something.
   * Operators are stopped; a manager may start in parallel with a reason, which goes into the journal.
   */
  const checkPreviousStep = async (opId: string): Promise<{ ok: boolean; note?: string }> => {
    const production = operations.filter((o) => o.kind !== "packaging");
    const idx = production.findIndex((o) => o.id === opId);
    if (idx <= 0) return { ok: true };
    const prev = production[idx - 1];
    // A finished previous step never blocks (older steps were closed without output reports).
    if (prev.status === "Finished" || stepGoodOutput(prev, stepEventsOf(prev.id)) > 0) return { ok: true };
    const label = `#${prev.stepNumber} ${prev.name}`;
    if (isOperator) {
      addNotification({ title: "Bosqichni boshlab bo'lmaydi", description: `${label} hali chiqim bermagan.`, severity: "error" });
      return { ok: false };
    }
    const reason = await askDialog.ask({
      title: "Oldingi bosqich chiqim bermagan",
      message: `${label} hali chiqim bermagan. Bosqichni parallel boshlash uchun sababini yozing.`,
      reasonLabel: "Sabab",
      confirmLabel: "Boshlash",
    });
    if (!reason) return { ok: false };
    return { ok: true, note: `Oldingi bosqichsiz boshlandi: ${reason}` };
  };

  const handleStartSetup = async (opId: string) => {
    const gate = await checkPreviousStep(opId);
    if (!gate.ok) return;
    logStepTransition(opId, "SetupStart", gate.note || "Sozlash boshlandi");
  };

  const handleStartRun = async (opId: string) => {
    const tl = getStepTimeline(stepEventsOf(opId));
    let note = "Ish boshlandi";
    if (tl.phase === "queued") {
      const gate = await checkPreviousStep(opId);
      if (!gate.ok) return;
      if (gate.note) note = gate.note;
    }
    logStepTransition(opId, "RunStart", note);
  };

  /** "To'xtatish": opens a downtime now; its length is measured until "Davom ettirish". */
  const handlePauseStep = (_opId: string) => {
    setEditingDowntimeEvent(null);
    setDowntimeDialogMode("open");
    setIsDowntimeDialogOpen(true);
  };

  /** A downtime that already ended (recorded afterwards, with its length). */
  const handleRecordDowntime = () => {
    setEditingDowntimeEvent(null);
    setDowntimeDialogMode("record");
    setIsDowntimeDialogOpen(true);
  };

  const handleOpenEditDowntimeEvent = (event: ShiftEvent) => {
    setEditingDowntimeEvent(event);
    setDowntimeDialogMode(isOpenDowntime(event) ? "open" : "record");
    setIsDowntimeDialogOpen(true);
  };

  /** Closes the open downtime with its measured length (at least one minute). */
  const closeOpenDowntime = (opId: string): number => {
    const tl = getStepTimeline(stepEventsOf(opId));
    const open = tl.openDowntime;
    if (!open || !open.occurredAt) return 0;
    const minutes = Math.max(1, Math.round((Date.now() - new Date(open.occurredAt).getTime()) / 60000));
    const previous = shiftEventsRef.current;
    const closed: ShiftEvent = { ...open, downtimeDurationMinutes: minutes };
    setShiftEvents(previous.map((ev) => (ev.id === open.id ? closed : ev)));
    void persistShiftEvent(closed, previous);
    setTabUnsaved(tab.id, true);
    return minutes;
  };

  const handleResumeStep = (opId: string) => {
    const minutes = closeOpenDowntime(opId);
    // A step paused before the journal kept transitions has no open downtime: restart its run instead.
    if (minutes === 0) logStepTransition(opId, "RunStart", "Davom ettirildi");
    addNotification({
      title: "Ish davom ettirildi",
      description: minutes > 0 ? `To'xtalish ${formatMinutes(minutes)} davom etdi.` : undefined,
      severity: "info",
    });
  };

  /**
   * Finishing needs at least one output report; short of plan it asks first.
   * `events` lets a report that was just added count before the list re-renders.
   */
  const handleFinishStep = async (opId: string, events: ShiftEvent[] = shiftEventsRef.current) => {
    const op = operations.find((o) => o.id === opId);
    if (!op) return;
    const good = stepGoodOutput(op, stepEventsOf(opId, events));
    if (good <= 0) {
      addNotification({
        title: "Yakunlab bo'lmaydi",
        description: "Avval chiqim hisobotini (palet) kiriting.",
        severity: "error",
      });
      return;
    }
    const plan = parseInt((op.qtyCompleted || "").split("/")[1]?.replace(/[^\d]/g, "") || "0", 10) || 0;
    let note = "Bosqich yakunlandi";
    if (plan > 0 && good < plan) {
      const ok = await askDialog.ask({
        title: "Qisman yakunlash",
        message: `Reja: ${plan.toLocaleString()}, fakt: ${good.toLocaleString()}. Bosqich qisman yakunlansinmi?`,
        confirmLabel: "Yakunlash",
      });
      if (ok === null) return;
      note = `Qisman yakunlandi: ${good.toLocaleString()} / ${plan.toLocaleString()}`;
    }
    closeOpenDowntime(opId);
    logStepTransition(opId, "Finish", note);
    addNotification({ title: "Bosqich yakunlandi", description: `#${op.stepNumber} ${op.name}`, severity: "success" });
  };

  /** Manager's status fix: needs a reason and stays in the journal as its own entry. */
  const handleCorrectStep = (opId: string, toStatus: RouteStep["status"], reason: string) => {
    if (!reason.trim()) return;
    if (toStatus !== "Paused") closeOpenDowntime(opId);
    logStepTransition(opId, "Correction", reason.trim(), { toStatus });
  };

  // The steps' status, times and downtime follow the journal (steps without transitions keep their own).
  useEffect(() => {
    setOperations((prev) => {
      let changed = false;
      const next = prev.map((op) => {
        const updated = applyTimelineToStep(op, getStepTimeline(shiftEvents.filter((ev) => ev.opId === op.id)));
        if (updated !== op) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [shiftEvents]);

  const handleSaveDowntime = (data: {
    eventId?: string;
    opId: string;
    shift: NonNullable<ShiftEvent["shift"]>;
    downtimeReason: string;
    durationMinutes: number;
    operator: string;
    note: string;
    time: string;
    /** Open: the step stops now and the length is measured until it resumes. */
    open: boolean;
  }) => {
    const previous = shiftEventsRef.current;
    const existing = data.eventId ? previous.find((ev) => ev.id === data.eventId) : undefined;
    const event: ShiftEvent = existing
      ? {
          ...existing,
          time: data.time || existing.time,
          occurredAt:
            existing.occurredAt && data.time && data.time !== existing.time
              ? atPlantTime(existing.occurredAt, data.time)
              : existing.occurredAt,
          shift: data.shift,
          downtimeReason: data.downtimeReason,
          downtimeDurationMinutes: isOpenDowntime(existing) ? existing.downtimeDurationMinutes : data.durationMinutes,
          note: data.note,
          operator: data.operator,
        }
      : {
          id: "e_dt_" + Date.now(),
          opId: data.opId,
          time: data.time,
          occurredAt: occurredAtFromTime(data.time),
          shift: data.shift,
          type: "Delay",
          downtimeReason: data.downtimeReason,
          downtimeDurationMinutes: data.open ? undefined : data.durationMinutes,
          note: data.note,
          operator: data.operator,
        };
    setShiftEvents(existing ? previous.map((ev) => (ev.id === event.id ? event : ev)) : [event, ...previous]);
    void persistShiftEvent(event, previous);

    setTabUnsaved(tab.id, true);
    addNotification({
      title: data.eventId ? "To'xtalish yangilandi" : data.open ? "Bosqich to'xtatildi" : "To'xtalish qayd etildi",
      description: data.open && !data.eventId ? data.downtimeReason : `${data.downtimeReason} (${data.durationMinutes} daqiqa)`,
      severity: "warning",
    });
  };

  const handleSavePalletEvent = (eventData: {
    eventId?: string;
    batchLabel: string;
    shift: NonNullable<ShiftEvent["shift"]>;
    operator: string;
    inputQty: number;
    makeReadyQty: number;
    defectQty: number;
    goodQty: number;
    outputPiecesQty?: number;
    wasteReason?: string;
    time: string;
    note: string;
    markStepFinished?: boolean;
    qtySource: NonNullable<ShiftEvent["qtySource"]>;
  }) => {
    const totalWaste = eventData.makeReadyQty + eventData.defectQty;
    const previousEvents = shiftEventsRef.current;

    let updatedEvents: ShiftEvent[];

    if (eventData.eventId) {
      // Editing existing event
      updatedEvents = shiftEvents.map((ev) => {
        if (ev.id !== eventData.eventId) return ev;
        return {
          ...ev,
          time: eventData.time || ev.time,
          occurredAt:
            ev.occurredAt && eventData.time && eventData.time !== ev.time
              ? atPlantTime(ev.occurredAt, eventData.time)
              : ev.occurredAt,
          shift: eventData.shift,
          batchLabel: eventData.batchLabel,
          note: eventData.note,
          operator: eventData.operator,
          inputQty: eventData.inputQty,
          qtySource: eventData.qtySource,
          makeReadyQty: eventData.makeReadyQty,
          defectQty: eventData.defectQty,
          goodQty: eventData.goodQty,
          outputPiecesQty: eventData.outputPiecesQty,
          wasteQty: totalWaste > 0 ? totalWaste : undefined,
          wasteReason: eventData.wasteReason,
        };
      });
    } else {
      // Creating new event
      const newEvent: ShiftEvent = {
        id: "e_" + Date.now(),
        opId: selectedOp.id,
        time: eventData.time,
        occurredAt: occurredAtFromTime(eventData.time),
        shift: eventData.shift,
        batchLabel: eventData.batchLabel,
        type: "Run",
        note: eventData.note,
        operator: eventData.operator,
        inputQty: eventData.inputQty,
        qtySource: eventData.qtySource,
        makeReadyQty: eventData.makeReadyQty,
        defectQty: eventData.defectQty,
        goodQty: eventData.goodQty,
        outputPiecesQty: eventData.outputPiecesQty,
        wasteQty: totalWaste > 0 ? totalWaste : undefined,
        wasteReason: eventData.wasteReason,
        palletNumber: shiftEvents.filter((ev) => ev.opId === selectedOp.id && ev.type === "Run").length + 1,
      };
      updatedEvents = [newEvent, ...shiftEvents];
    }

    setShiftEvents(updatedEvents);
    const changed = updatedEvents.find((ev) =>
      eventData.eventId ? ev.id === eventData.eventId : !previousEvents.includes(ev)
    );
    if (changed) void persistShiftEvent(changed, previousEvents);

    // Calculate total completed for this op including this event
    const thisOpEvents = updatedEvents.filter((ev) => ev.opId === selectedOp.id);
    const totalGood = thisOpEvents.reduce((sum, ev) => sum + (ev.goodQty || 0), 0);

    // Update operations state
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== selectedOp.id) return op;
        const targetMatch = (op.qtyCompleted || "").match(/\/\s*(.+)$/);
        const targetStr = targetMatch ? ` / ${targetMatch[1]}` : "";
        return {
          ...op,
          qtyCompleted: `${totalGood.toLocaleString()}${targetStr}`,
          operator: eventData.operator,
        };
      })
    );

    setTabUnsaved(tab.id, true);
    if (eventData.markStepFinished) void handleFinishStep(selectedOp.id, updatedEvents);

    addNotification({
      title: "Palet hisoboti saqlandi",
      description: `${selectedOp.name}: ${eventData.batchLabel} (${eventData.goodQty.toLocaleString()} list) qayd etildi.`,
      severity: "success",
    });
  };

  const handleDeleteShiftEvent = async (eventId: string) => {
    const ok = await askDialog.ask({
      title: "Yozuvni o'chirish",
      message: "Smena jurnalidagi yozuv o'chirilsinmi? Yozuv izi bazada qoladi.",
      confirmLabel: "O'chirish",
      destructive: true,
    });
    if (ok === null) return;
    const previous = shiftEventsRef.current;
    setShiftEvents(previous.filter((ev) => ev.id !== eventId));
    const orderNo = getSavedOrderNo();
    if (!orderNo) return;
    const res = await useWorkspaceStore.getState().deleteWorkOrderEventAsync(orderNo, eventId);
    if (!res.success) {
      setShiftEvents(previous);
      addNotification({ title: "Yozuv o'chirilmadi", description: res.error, severity: "error" });
    }
  };

  const handleSaveLogEvent = () => {
    if (!logEventForm.note.trim()) return;
    const newEvent: ShiftEvent = {
      id: "e_" + Date.now(),
      opId: selectedOp.id,
      time: logEventForm.time,
      occurredAt: occurredAtFromTime(logEventForm.time),
      type: logEventForm.type,
      note: logEventForm.note.trim(),
      operator: selectedOp.operator,
      wasteQty: logEventForm.wasteQty,
      wasteReason: logEventForm.wasteReason,
    };
    const previous = shiftEventsRef.current;
    setShiftEvents([newEvent, ...previous]);
    void persistShiftEvent(newEvent, previous);
    setIsLogEventDialogOpen(false);
  };

  const isTermo = formData.department === "Termo";
  const isFlexo = !isTermo && (formData.department === "Flexo" || (formData.recipe ? formData.recipe.startsWith("FLEXO_") : false));
  const isJacquard = !isTermo && (formData.department === "Jacquard" || (formData.recipe ? formData.recipe.startsWith("JACQ_") : false));
  const isOffset = !isFlexo && !isJacquard && !isTermo;

  const rawActiveTab = tab.activeLevel3Tab || "overview";
  const activeTab = (isOperator && rawActiveTab === "financials")
    ? "overview"
    : (!isOffset && rawActiveTab === "layout")
    ? "specs"
    : (!isFlexo && rawActiveTab === "flexo")
    ? "specs"
    : (!isTermo && rawActiveTab === "die")
    ? "specs"
    : rawActiveTab;

  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([activeTab]));

  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const readinessFallbackData = useMemo(() => ({
    customer: formData.customer,
    product: formData.product,
    machine: formData.pressMachine,
    department: formData.department,
    quantity: formData.quantity,
    deadline: formData.deadline,
    checks: formData.checks || queueItem?.checks,
  }), [formData.customer, formData.product, formData.pressMachine, formData.department, formData.quantity, formData.deadline, formData.checks, queueItem?.checks]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 20);
    return () => clearTimeout(timer);
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab === "history") {
      setHistoryRefreshTrigger((prev) => prev + 1);
    }
  }, [activeTab]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1C Level-3 Document Workspace Header Bar */}
        <DocumentHeader
          icon={Factory}
          title={formData.product || tOrder("newOrder")}
          docNo={docNo || tOrder("newAutoDocNo")}
          date={formData.startDate || "2026-09-30"}
          status={formData.status}
          priority={formData.priority}
          parentDocRef={
            formData.parentWorkOrderId
              ? {
                  docNo: formData.parentWorkOrderId,
                  label: `${tOrder("baseOrder")}: ${formData.parentWorkOrderId} (${tOrder("reorder")})`,
                  onClick: () => handleOpenParentWorkOrder(formData.parentWorkOrderId!),
                }
              : undefined
          }
          actions={
            <>
              {/* 1. Job Ticket / Passport Print (Icon button with tooltip) */}
              <HeaderIconAction
                icon={Printer}
                label={`${tOrder("jobTicket")} (Ctrl+P)`}
                variant="outline"
                onClick={() => setIsJobTicketOpen(true)}
              />

              {/* Telegram Buyurtmalar guruhiga yuborish */}
              <HeaderIconAction
                icon={Send}
                label="Telegram guruhga yuborish"
                variant="outline"
                onClick={() => setIsTelegramOrdersModalOpen(true)}
              />

              {/* 3. Three Vertical Dots (Dropdown Menu with secondary actions) */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                      aria-label={tOrder("moreActions")}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-60 text-xs">
                  <DropdownMenuItem
                    onClick={handleReorderWorkOrder}
                    className="gap-2 cursor-pointer font-medium text-blue-700 dark:text-blue-400"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{tOrder("reorderAction")}</span>
                  </DropdownMenuItem>

                  {!isOperator && (
                    <DropdownMenuItem
                      onClick={() => setIsSaveSpecDialogOpen(true)}
                      className="gap-2 cursor-pointer font-medium text-violet-700 dark:text-violet-400"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      <span>{tOrder("saveAsSpec")}</span>
                    </DropdownMenuItem>
                  )}

                  {!isOperator && (
                    <DropdownMenuItem
                      onClick={() => {
                        const newAct = createDeliveryActFromOrder({
                          orderId: data.docNo || tab.id,
                          workOrderId: data.docNo || tab.id,
                          customer: formData.customer || "Alpha Media Group LLC",
                          product: formData.product || "A4 Hardcover Catalog 96p",
                          quantity: formData.quantity || 5000,
                          unit: formData.unit || "pcs",
                          priceTotal: formData.priceTotal || 14850,
                          currency: formData.currency || "USD",
                        });
                        openTab({
                          id: newAct.id,
                          title: `${newAct.id}: ${newAct.customer}`,
                          type: "delivery-act",
                          module: "finance",
                          isUnsaved: false,
                          activeLevel3Tab: "overview",
                          documentData: newAct,
                        });
                      }}
                      className="gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400 font-medium"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{tAct("createFromOrder") || tShell("createDeliveryAct")}</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setIsJobTicketOpen(true)} className="gap-2 cursor-pointer">
                    <Printer className="w-3.5 h-3.5" />
                    <span>{tOrder("jobTicket")}</span>
                    <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setIsTelegramOrdersModalOpen(true)} className="gap-2 cursor-pointer">
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram guruhga yuborish</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleRequestDelete}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    <span>{tOrder("cancelOrDeleteOrder")}</span>
                    {!canDelete && (
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{tOrder("unauthorized")}</span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-4 mx-0.5" />

              {/* 4. Save icon button */}
              <HeaderIconAction
                icon={isSaving ? Loader2 : Save}
                label={`${tOrder("save")} (Ctrl+S)`}
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                className={isSaving ? "opacity-60 pointer-events-none" : ""}
              />

              {/* 5. Primary Post & Close button */}
              <Button
                onClick={handleSaveAndClose}
                size="sm"
                disabled={isSaving}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{tOrder("postAndClose")}</span>
              </Button>
            </>
          }
        />

        {/* Main Workspace Body: Left Sub-Sidebar + Right Content Viewport */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel={tShell("sections")}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Building2}
                title={formData.customer}
                subtitle={formData.product}
              >
                {formData.parentWorkOrderId && (
                  <button
                    type="button"
                    onClick={() => handleOpenParentWorkOrder(formData.parentWorkOrderId!)}
                    className="w-full text-left flex items-center justify-between px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-700 dark:text-blue-400 font-semibold mb-1.5 hover:bg-blue-500/20 transition-colors cursor-pointer"
                    title={`${tOrder("baseOrder")}: ${formData.parentWorkOrderId} (${tOrder("clickToView")})`}
                  >
                    <span className="flex items-center gap-1 truncate mr-1">
                      <RotateCw className="w-3 h-3 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">{tOrder("baseOrder")}: {formData.parentWorkOrderId}</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-400 text-blue-700 dark:text-blue-300 shrink-0">
                      {tOrder("reorder")}
                    </Badge>
                  </button>
                )}

                {isOperator && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-700 dark:text-amber-400 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Floor Mode · Specs Locked</span>
                  </div>
                )}

                {/* 1. Adad (va Namuna bo'lsa sinov adadi) */}
                <InfoRow label={tShell("quantity")}>
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-foreground">
                      {formData.quantity.toLocaleString()} {formData.unit}
                    </span>
                    {formData.orderType === "Sample" && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        ({tOrder("sampleLabel")}: {sampleData.sampleQty} {formData.unit || tOrder("pcsUnit")})
                      </span>
                    )}
                  </div>
                </InfoRow>

                {/* 1.1 Jami Summa (faqat menejer/rahbarlar uchun, read-only) */}
                {!isOperator && (
                  <InfoRow label={tOrder("totalAmount")}>
                    <div className="flex flex-col items-end text-right">
                      <span className="font-mono font-bold text-foreground">
                        {formatMoney(formData.priceTotal, formData.currency, 0)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ~{formatMoney(
                          (formData.currency || "UZS").toUpperCase() === "USD"
                            ? formData.priceTotal * (formData.exchangeRate || 12850)
                            : ((formData.exchangeRate || 12850) > 0 ? formData.priceTotal / (formData.exchangeRate || 12850) : 0),
                          (formData.currency || "UZS").toUpperCase() === "USD" ? "UZS" : "USD",
                          0
                        )}
                        {" · "}
                        {(formData.exchangeRate || 12850).toLocaleString()}
                      </span>
                    </div>
                  </InfoRow>
                )}

                {/* 2. Qog'oz / Xomashyo */}
                <InfoRow label={tOrder("paperLabel")} title={formData.paperStock}>
                  <span className="truncate max-w-[125px] font-medium text-foreground" title={formData.paperStock}>
                    {formData.paperStock || tOrder("notSpecified")}
                  </span>
                </InfoRow>

                {/* 3. Ranglilik (CMYK / Pantones) */}
                <InfoRow label={tOrder("colorsLabel")}>
                  <span className="font-mono font-medium text-foreground">
                    {formData.colorsConfig || "—"}
                  </span>
                </InfoRow>

                {/* 5. Muddat va Qolgan kunlar */}
                <InfoRow label={tShell("deadline")}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-foreground">{formData.deadline}</span>
                    {deadlineCountdown !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1 py-0 h-4 font-mono font-medium",
                          deadlineCountdown < 0
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : deadlineCountdown <= 2
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {deadlineCountdown < 0
                          ? tOrder("overdue")
                          : deadlineCountdown === 0
                          ? tOrder("today")
                          : tOrder("daysRemaining", { count: deadlineCountdown })}
                      </Badge>
                    )}
                  </div>
                </InfoRow>

                {/* 6. Holat / Bosqich */}
                <InfoRow label={tOrder("stageLabel")}>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-medium",
                      formData.stage === "In Production"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : formData.stage === "Completed"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {formData.stage || "Queue"}
                  </Badge>
                </InfoRow>

                {/* 7. Xomashyo yetishmasligi (BOM shortage alert) */}
                {hasShortage && (
                  <div className="flex items-center gap-1 pt-1.5 border-t border-border/50 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">{tShell("materialShortage")}</span>
                  </div>
                )}
              </SidebarSummaryCard>
            }
            items={[
              { id: "overview", label: tOrder("tabOverview"), icon: FileText },
              {
                id: "specs",
                label: tShell("specsAndDrawing"),
                icon: Ruler,
                badge: formData.width && formData.height ? `${formData.width}×${formData.height}` : null,
              },
              ...(isOffset ? [{ id: "layout", label: tOrder("tabPlanning"), icon: LayoutTemplate }] : []),
              ...(isFlexo ? [{ id: "flexo", label: "Flexo Imposition", icon: Disc }] : []),
              ...(isTermo ? [{ id: "die", label: "Pichoq", icon: Stamp }] : []),
              {
                id: "prepress-tooling",
                label: tOrder("tabPrepressTooling"),
                icon: Stamp,
                badge: (formData.toolingItems || []).length > 0 ? tOrder("itemsCount", { count: (formData.toolingItems || []).length }) : null,
                badgeClassName: (formData.toolingItems || []).some((t) => t.status === "Draft" || t.status === "Ordered")
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                  : undefined,
              },
              {
                id: "materials",
                label: tOrder("tabMaterials"),
                icon: Boxes,
                badge: currentRecipeMaterials.length,
                badgeClassName: hasShortage
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                  : undefined,
              },
              { id: "operations", label: tOrder("tabOperations"), icon: Factory, badge: operations.length },
              {
                id: "timeline",
                label: tOrder("tabTimeline"),
                icon: Clock,
                badge: `${operations.filter((o) => o.status === "Finished").length}/${operations.length}`,
              },
              {
                id: "shipments",
                label: tOrder("tabShipments"),
                icon: Truck,
                badge: (formData.deliveryBatches || []).length || null,
              },
              ...(!isOperator
                ? [
                    {
                      id: "financials",
                      label: tOrder("tabCosting"),
                      icon: DollarSign,
                      badge: formatMoney(formData.priceTotal, formData.currency, 0),
                    },
                  ]
                : []),
              { id: "files", label: tShell("filesAndDocs"), icon: Paperclip, badge: orderAttachments.length || null },
              { id: "history", label: tOrder("tabHistory"), icon: History },
            ]}
          />

          {/* ── RIGHT MAIN VIEWPORT (flex-1) ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {/* Tab 1: Overview */}
            {visitedTabs.has("overview") && (
              <OverviewTab
                onSelectProductTemplate={handleSelectProductTemplate}
                formData={{ ...formData, skuArtworks }}
                handleFieldChange={handleFieldChange}
                handleSizesChange={handleSizesChange}
                handleDepartmentChange={handleDepartmentChange}
                data={data}
                tabId={tab.id}
                activeSpec={activeSpec}
                activeSite={activeSite}
                activeTech={activeTech}
                activeMachine={activeMachine}
                currentDeptMachines={currentDeptMachines}
                currentRecipeMaterials={currentRecipeMaterials}
                materials={currentBomItems}
                operations={operations}
                hasShortage={hasShortage}
                orderAttachments={orderAttachments}
                setOrderAttachments={setOrderAttachments}
                sampleData={sampleData}
                onSampleChange={handleSampleChange}
                onApproveAndReleaseMassRun={handleApproveSampleAndRelease}
                onRejectSample={handleRejectSample}
                onOpenLightbox={() => setIsLightboxOpen(true)}
                onOpenTab={openTab}
                onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                isOperator={isOperator}
                
                errors={formErrors}
                setErrors={setFormErrors}
                tOrder={tOrder}
              />
            )}

            {/* Tab 2: Specifications & Die-Line (Extracted & Enhanced) */}
            {visitedTabs.has("specs") && (
              <SpecificationsTab
                formData={{ ...formData, skuArtworks }}
                handleFieldChange={handleFieldChange}
                handleSizesChange={handleSizesChange}
                onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                isOperator={isOperator}
                
                sampleData={sampleData}
                onSampleChange={handleSampleChange}
                orderAttachments={orderAttachments}
                setOrderAttachments={setOrderAttachments}
                skuArtworks={skuArtworks}
                onSkuArtworksChange={handleSkuArtworksChange}
                docNo={docNo || tab.id}
              />
            )}

            {/* Tab: Imposition / Layout for Offset & Front-Back Print Planning */}
            {isOffset && (
              <TabsContent value="layout" keepMounted={false} className="flex-1 overflow-y-auto p-3 m-0 no-scrollbar">
                {activeTab === "layout" && (
                  <LayoutCalcTab
                    sizes={formData.sizes || []}
                    defaultQuantity={formData.quantity}
                    docNo={data.docNo || tab.id}
                    customer={formData.customer}
                    orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
                    defaultProdW={formData.width}
                    defaultProdH={formData.height}
                    defaultBleed={formData.bleed}
                    shapeType={formData.shapeType}
                    dieSpec={{
                      cornerType: formData.cornerType,
                      customShape: formData.customShape,
                      customSvgPath: formData.customSvgPath,
                      foldType: formData.foldType,
                      itemCategory: formData.itemCategory,
                      holeSize: formData.holeSize,
                      holePosition: formData.holePosition,
                      holeOffset: formData.holeOffset,
                    }}
                    dieline={formData.dieline}
                    onDielineChange={(dl) => {
                      handleFieldChange("dieline", dl);
                      setTabUnsaved(tab.id, true);
                    }}
                    orderAttachments={orderAttachments}
                    toolingItems={formData.toolingItems}
                    artworkFront={formData.artworkFront}
                    artworkBack={formData.artworkBack}
                    skuArtworks={skuArtworks}
                    frontColors={formData.frontColors}
                    backColors={formData.backColors}
                    spotColors={formData.spotColorItems}
                    printMethod={formData.printMethod}
                    kashirovkaPlates={kashirovkaPlatesPerForm(
                      formData.kashirovkaMode,
                      formData.kashirovkaLayers,
                      formData.kashirovkaStrategy
                    )}
                    onPrintMethodChange={(method) => handleFieldChange("printMethod", method)}
                    pressMachine={formData.pressMachine}
                    activeMachine={activeMachine}
                    paperStock={formData.paperStock}
                    warehouseStock={warehouseStock}
                    parentSheetW={formData.parentSheetW}
                    parentSheetH={formData.parentSheetH}
                    pressSheetW={formData.pressSheetW}
                    pressSheetH={formData.pressSheetH}
                    plannedSheets={formData.plannedSheets}
                    appliedCtpPlates={(formData.toolingItems || []).find((t) => t.category === "ctp_plates")?.quantity}
                    isOperator={isOperator}
                    onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                    onAddAttachment={(att) => {
                      setOrderAttachments((prev) => [...prev.filter((a) => a.id !== att.id && a.name !== att.name), att]);
                      setTabUnsaved(tab.id, true);
                    }}
                    impositionState={formData.impositionState}
                    onImpositionStateChange={(impState) => {
                      setFormData((prev) => ({ ...prev, impositionState: impState }));
                      updateTabData(tab.id, { impositionState: impState });
                    }}
                    onApplyToOrder={(payload) => {
                      const currentTools = formData.toolingItems || [];
                      const ctpIdx = currentTools.findIndex((t) => t.category === "ctp_plates");
                      let nextTooling = [...currentTools];
                      const isUsd = (formData.currency || "UZS").toUpperCase() === "USD";
                      const unitCtpCost = isUsd ? 6 : 75000;
                      const rawOrderNo = docNo || data.docNo || tab.id;
                      const isDraftOrder = !rawOrderNo || rawOrderNo.startsWith("draft-") || rawOrderNo.startsWith("temp-");
                      const displayOrderNo = !isDraftOrder ? rawOrderNo : (formData.product ? formData.product : "");
                      const ctpItemName = displayOrderNo ? `${displayOrderNo} CTP Metall Formalar Komplekti` : "CTP Metall Formalar Komplekti";

                      if (ctpIdx >= 0) {
                        if (payload.totalCtpPlates > 0) {
                          nextTooling[ctpIdx] = {
                            ...nextTooling[ctpIdx],
                            name: ctpItemName,
                            quantity: payload.totalCtpPlates,
                            specDetails: payload.ctpSpecDetails,
                            estimatedCost: unitCtpCost * payload.totalCtpPlates,
                          };
                        } else {
                          nextTooling.splice(ctpIdx, 1);
                        }
                      } else if (payload.totalCtpPlates > 0) {
                        nextTooling = [
                          {
                            id: `TL-CTP-${Date.now()}`,
                            category: "ctp_plates",
                            name: ctpItemName,
                            specDetails: payload.ctpSpecDetails,
                            quantity: payload.totalCtpPlates,
                            unit: "dona",
                            estimatedCost: unitCtpCost * payload.totalCtpPlates,
                            currency: formData.currency || "UZS",
                            status: "Draft",
                            createdAt: new Date().toISOString(),
                          },
                          ...nextTooling,
                        ];
                      }

                      const totalCost = nextTooling.reduce(
                        (sum, it) => sum + (it.actualCost !== undefined ? it.actualCost : it.estimatedCost || 0),
                        0
                      );

                      handleFieldChange({
                        ...(payload.paperStock ? { paperStock: payload.paperStock } : {}),
                        parentSheetW: payload.parentSheetW,
                        parentSheetH: payload.parentSheetH,
                        pressSheetW: payload.pressSheetW,
                        pressSheetH: payload.pressSheetH,
                        plannedSheets: payload.plannedParentSheets,
                        ...(payload.printMethod ? { printMethod: payload.printMethod } : {}),
                        toolingItems: nextTooling,
                        toolingProcurementCost: totalCost,
                        toolingProcurementNeeded: nextTooling.some(
                          (it) => it.status === "Draft" || it.status === "Ordered"
                        ),
                      });
                      setTabUnsaved(tab.id, true);
                      addNotification({
                        title: "Montaj buyurtmaga qo'llandi",
                        description: `Xom qog'oz: ${payload.plannedParentSheets.toLocaleString()} list (${payload.plannedPressSheets.toLocaleString()} bosma list) · CTP: ${payload.totalCtpPlates} dona.`,
                        severity: "success",
                      });
                    }}
                  />
                )}
              </TabsContent>
            )}

            {/* Tab: Termo flat-bed die layout */}
            {isTermo && (
              <TabsContent value="die" keepMounted={false} className="flex-1 overflow-y-auto p-3 m-0 no-scrollbar">
                {activeTab === "die" && (
                  <DieLayoutTab
                    formData={formData}
                    docNo={data.docNo || tab.id}
                    isOperator={isOperator}
                    handleFieldChange={handleFieldChange}
                    onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                    onAddTooling={(item) => {
                      setFormData((prev) => ({
                        ...prev,
                        toolingItems: [
                          ...(prev.toolingItems || []).filter(
                            (it) => !(it.id.startsWith("TL-DIE-TERMO-") && it.status === "Draft" && !it.purchaseOrderNo)
                          ),
                          item,
                        ],
                      }));
                      setTabUnsaved(tab.id, true);
                    }}
                  />
                )}
              </TabsContent>
            )}

            {/* Tab: Flexo Imposition & Cylinder Repeat */}
            {isFlexo && (
              <TabsContent value="flexo" keepMounted={false} className="flex-1 overflow-y-auto p-3 m-0 no-scrollbar">
                {activeTab === "flexo" && (
                  <FlexoCalcTab
                    defaultQuantity={formData.quantity}
                    docNo={data.docNo || tab.id}
                    orderName={`${formData.customer ? formData.customer + " — " : ""}${formData.product || data.docNo || tab.id}`}
                    customer={formData.customer}
                    productName={formData.product}
                    defaultProdW={formData.width}
                    defaultProdH={formData.height}
                    defaultBleed={formData.bleed}
                    materialName={formData.paperStock}
                    webWidthMm={Number(formData.flexoWebWidth) || undefined}
                    orderAttachments={orderAttachments}
                    setOrderAttachments={setOrderAttachments}
                    onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                    onSwitchTab={(target) => setLevel3Tab(tab.id, target)}
                    onAuditLog={() => {}}
                    flexoImpositionState={formData.flexoImpositionState}
                    onFlexoImpositionStateChange={(flexoState) => {
                      setFormData((prev) => ({ ...prev, flexoImpositionState: flexoState }));
                      updateTabData(tab.id, { flexoImpositionState: flexoState });
                      setTabUnsaved(tab.id, true);
                    }}
                    onFlexoSave={({ gearTeeth }) => {
                      if (gearTeeth && formData.flexoCylinderTeeth !== gearTeeth) {
                        setFormData((prev) => ({ ...prev, flexoCylinderTeeth: gearTeeth }));
                      }
                    }}
                    onFlexoFilmAttached={({ colorCount, filename, gearTeeth }) => {
                      const rawDocNo = data.docNo || tab.id;
                      const isDraftDocNo = !rawDocNo || rawDocNo.startsWith("draft-") || rawDocNo.startsWith("temp-");
                      const cleanDocNo = !isDraftDocNo ? rawDocNo : (formData.product || "WO");
                      const isUsd = (formData.currency || "UZS").toUpperCase() === "USD";
                      const perPlateCost = isUsd ? 10 : 112500;
                      const nextCost = perPlateCost * colorCount;
                      setFormData((prev) => {
                        const existing = prev.toolingItems || [];
                        const draftIdx = existing.findIndex(
                          (it) => it.category === "flexo_polymer" && it.status === "Draft" && !it.purchaseOrderNo
                        );
                        let nextTooling: WorkOrderToolingItem[];
                        if (draftIdx >= 0) {
                          nextTooling = existing.map((it, idx) =>
                            idx === draftIdx
                              ? {
                                  ...it,
                                  specDetails: `Digital Plate 1.14mm, ${colorCount} rang (${filename})`,
                                  quantity: colorCount,
                                  estimatedCost: nextCost,
                                }
                              : it
                          );
                        } else {
                          nextTooling = [
                            ...existing,
                            {
                              id: `TL-FLX-${Date.now()}`,
                              category: "flexo_polymer",
                              name: `${cleanDocNo} Flexo Polimer Formalar`,
                              specDetails: `Digital Plate 1.14mm, ${colorCount} rang (${filename})`,
                              quantity: colorCount,
                              unit: "dona",
                              estimatedCost: nextCost,
                              currency: prev.currency || "UZS",
                              status: "Draft",
                              createdAt: new Date().toISOString(),
                            },
                          ];
                        }
                        const totalCost = nextTooling.reduce(
                          (sum, it) => sum + (it.actualCost !== undefined ? it.actualCost : it.estimatedCost || 0),
                          0
                        );
                        return {
                          ...prev,
                          flexoColors: colorCount,
                          ...(gearTeeth ? { flexoCylinderTeeth: gearTeeth } : {}),
                          toolingItems: nextTooling,
                          toolingProcurementCost: totalCost,
                          toolingProcurementNeeded: nextTooling.some(
                            (it) => it.status === "Draft" || it.status === "Ordered"
                          ),
                        };
                      });
                      setTabUnsaved(tab.id, true);
                    }}
                  />
                )}
              </TabsContent>
            )}

            {/* Tab: Prepress & Tooling (CTP, Klishe, Shtamp) */}
            {visitedTabs.has("prepress-tooling") && (
              <TabsContent value="prepress-tooling" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <PrepressToolingTab
                  formData={formData}
                  docNo={data.docNo || tab.id}
                  isOperator={isOperator}
                  orderAttachments={orderAttachments}
                  setOrderAttachments={setOrderAttachments}
                  onUpdateTooling={(newItems) => {
                    handleFieldChange("toolingItems", newItems);
                    const totalCost = newItems.reduce(
                      (sum, it) => sum + (it.actualCost !== undefined ? it.actualCost : it.estimatedCost || 0),
                      0
                    );
                    handleFieldChange("toolingProcurementCost", totalCost);
                    handleFieldChange(
                      "toolingProcurementNeeded",
                      newItems.some((it) => it.status === "Draft" || it.status === "Ordered")
                    );

                    // ─── Live Auto-Sync to Production Readiness Gates ───
                    const ctpItems = newItems.filter(
                      (i) => i.category === "ctp_plates" || i.category === "flexo_polymer"
                    );
                    const dieItems = newItems.filter(
                      (i) =>
                        i.category === "die_cutting" ||
                        i.category === "foil_cliche" ||
                        i.category === "emboss_cliche" ||
                        i.category === "varnish_plate"
                    );

                    const platesReady =
                      ctpItems.length > 0 && ctpItems.every((i) => i.status === "Ready");
                    const toolingReady =
                      dieItems.length > 0 && dieItems.every((i) => i.status === "Ready");

                    const targetId = data.docNo || tab.id;
                    const currentQueueItem = useWorkspaceStore.getState().productionQueue.find((q) => {
                      const key = (targetId || "").trim().toLowerCase();
                      return q.id?.toLowerCase() === key || (q.docNo && q.docNo.toLowerCase() === key);
                    });
                    const platesAudit = currentQueueItem?.checks?.audit?.platesReady || (formData.checks as any)?.audit?.platesReady;
                    const toolingAudit = currentQueueItem?.checks?.audit?.toolingReady || (formData.checks as any)?.audit?.toolingReady;

                    if (toggleReadinessCheck) {
                      if (!platesAudit?.verifiedBy) {
                        toggleReadinessCheck(targetId, "platesReady", {
                          forceStatus: platesReady ? "ready" : "pending",
                        });
                      }
                      if (!toolingAudit?.verifiedBy) {
                        toggleReadinessCheck(targetId, "toolingReady", {
                          forceStatus: toolingReady ? "ready" : "pending",
                        });
                      }
                    }

                    handleFieldChange("checks", {
                      ...((formData as any).checks || {}),
                      ...(platesAudit?.verifiedBy ? {} : { platesReady }),
                      ...(toolingAudit?.verifiedBy ? {} : { toolingReady }),
                    });
                  }}
                  onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                />
              </TabsContent>
            )}

            {/* Tab 3: Materials BOM */}
            {visitedTabs.has("materials") && (
              <MaterialsTab
                tabId={tab.id}
                department={formData.department}
                recipe={formData.recipe}
                activeSpec={activeSpec}
                initialItems={currentBomItems}
                currency={formData.currency || "UZS"}
                exchangeRate={formData.exchangeRate || 12850}
                materialsConsumed={formData.materialsConsumed}
                materialIssueDocNo={formData.materialIssueDocNo}
                onExecuteSpisanie={handleExecuteSpisanie}
                onOpenIssueTab={handleOpenMaterialIssueTab}
                shiftWasteSheets={totalShiftWasteSheets}
                onRecipeChange={(code, dept) => {
                  handleFieldChange("recipe", code);
                  if (dept && formData.department !== dept) {
                    handleDepartmentChange(dept);
                  }
                }}
                onOpenTab={openTab}
                isOperator={isOperator}
                
                onItemsChange={(newItems) => {
                  const hadPrimarySubstrate = currentBomItems.some(
                    (i) => i.category === "Paper & Board" || i.category === "Roll & Label"
                  );
                  setCurrentBomItems(newItems);
                  handleFieldChange("materials", newItems);
                  const primarySubstrate = newItems.find(
                    (i) => i.category === "Paper & Board" || i.category === "Roll & Label"
                  );
                  if (primarySubstrate?.name && primarySubstrate.name !== formData.paperStock) {
                    setFormData((prev) => ({ ...prev, paperStock: primarySubstrate.name }));
                    updateTabData(tab.id, { paperStock: primarySubstrate.name });
                    setTabUnsaved(tab.id, true);
                  } else if (hadPrimarySubstrate && !primarySubstrate && formData.paperStock) {
                    setFormData((prev) => ({ ...prev, paperStock: "" }));
                    updateTabData(tab.id, { paperStock: "" });
                    setTabUnsaved(tab.id, true);
                  }
                  syncPaperReadiness(newItems);
                }}
                onSaveAsSpec={(items) => {
                  setCurrentBomItems(items);
                  setIsSaveSpecDialogOpen(true);
                }}
              />
            )}

            {/* Tab 4: Technological Route */}
            {visitedTabs.has("operations") && (
              <OperationsTab
                workOrderId={data.docNo || tab.id}
                currency={formData.currency || "UZS"}
                exchangeRate={Number(formData.exchangeRate) || 12850}
                onOpenPackaging={() => setIsPackagingOpen(true)}
                packagingInfo={packagingStepInfo}
                fallbackData={readinessFallbackData}
                operations={operations}
                setOperations={setOperations}
                opSelection={opSelection}
                setOpSelection={setOpSelection}
                onOpenAddOperation={handleOpenAddOperation}
                onOpenEditOperation={handleOpenEditOperation}
                onDeleteSelectedOperation={handleDeleteSelectedOperation}
                isDark={isDark}
                isOperator={isOperator}
                
                onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                onSelectSpecification={handleSelectProductTemplate}
                recipe={formData.recipe}
                activeSpec={activeSpec}
                onOpenInTimeline={(opId) => {
                  setSelectedTimelineOpId(opId);
                  setLevel3Tab(tab.id, "timeline");
                }}
                onStageChange={(stage) => handleFieldChange("stage", stage)}
              />
            )}

            {/* Tab 5: Shift Timeline & Notes */}
            {visitedTabs.has("timeline") && (
              <ShiftTimelineTab
                workOrderNo={data.docNo || tab.id}
                productName={formData.product}
                customerName={formData.customer}
                operations={operations}
                selectedTimelineOpId={selectedTimelineOpId}
                setSelectedTimelineOpId={setSelectedTimelineOpId}
                selectedOp={selectedOp}
                selectedOpEvents={selectedOpEvents}
                allEvents={shiftEvents}
                onOpenQuickPalletLog={handleOpenLogEvent}
                onOpenPackaging={() => setIsPackagingOpen(true)}
                profileOf={profileOf}
                onOpenEditPalletLog={handleOpenEditPalletEvent}
                onOpenDowntimeLog={handleRecordDowntime}
                onOpenEditDowntimeLog={handleOpenEditDowntimeEvent}
                onStartSetup={handleStartSetup}
                onStartStep={handleStartRun}
                onPauseStep={handlePauseStep}
                onResumeStep={handleResumeStep}
                onFinishStep={(opId) => handleFinishStep(opId)}
                onCorrectStep={isOperator ? undefined : handleCorrectStep}
                onDeleteEvent={handleDeleteShiftEvent}
                piecesPerSheet={activePrintPlan.piecesPerSheet}
              />
            )}

            {/* Tab 6: Financials (Hidden for Operators) */}
            {!isOperator && visitedTabs.has("financials") && (
              <FinancialsTab
                shiftEvents={shiftEvents}
                formData={{ ...formData, skuArtworks }}
                printPlan={activePrintPlan}
                operations={operations}
                materials={currentBomItems}
                docNo={data.docNo || tab.id}
                onFinancialsChange={(fin) => handleFieldChange("financials", fin)}
                onPriceChange={(newPrice, fin) => {
                  handleFieldChange("priceTotal", newPrice);
                  if (fin) {
                    handleFieldChange("financials", fin);
                  }
                  persistOrderDetails();
                }}
              />
            )}

            {/* Tab 7: Files & Tech Documents */}
            {visitedTabs.has("files") && (
              <FilesTab
                orderAttachments={orderAttachments}
                setOrderAttachments={setOrderAttachments}
                onMarkUnsaved={() => setTabUnsaved(tab.id, true)}
                docNo={data.docNo || tab.id}
                onFileUploaded={(newAtt) => {
                  if (newAtt.isImage) {
                    if (!formData.photoUrl) {
                      handleFieldChange("photoUrl", newAtt.url);
                    }
                    if (!formData.photoUrls || formData.photoUrls.length === 0) {
                      handleFieldChange("photoUrls", [newAtt.url]);
                    }
                    if (!formData.artworkFront) {
                      handleFieldChange("artworkFront", newAtt.url);
                    }
                  }
                }}
              />
            )}

                        {/* Tab: Shipments & Deliveries */}
            {visitedTabs.has("shipments") && (
              <ShipmentsTab
                formData={formData}
                docNo={docNo || data.docNo || tab.id}
                operations={operations}
                shiftEvents={shiftEvents}
                onUpdateBatches={(newBatches) => {
                  handleFieldChange("deliveryBatches", newBatches);
                  setTabUnsaved(tab.id, true);
                }}
                onCreateShipment={handleCreateShipmentForBatch}
                onOpenShipment={handleOpenShipmentTab}
                onOpenDeliveryAct={handleOpenDeliveryActTab}
                onOpenPrintLabels={() => setIsLabelPrintOpen(true)}
                onHandOver={() => handleHandOverPackaging()}
              />
            )}

            {/* Tab 8: History */}
            {visitedTabs.has("history") && (
              <HistoryTab
                docNo={docNo || data.docNo || tab.id}
                formData={{ ...formData, skuArtworks }}
                refreshTrigger={historyRefreshTrigger}
              />
            )}
          </div>
        </div>
      </Tabs>

      {/* Dialog: Routing Operation */}
      {isOpDialogOpen && (
        <OperationDialog
          isOpen={isOpDialogOpen}
          onOpenChange={setIsOpDialogOpen}
          editingOpIndex={editingOpIndex}
          form={opDialogForm}
          setForm={setOpDialogForm}
          onSave={handleSaveOperationDialog}
          customerName={formData.customer}
          orderQuantity={formData.quantity}
          plannedSheets={formData.plannedSheets}
          currency={formData.currency}
          exchangeRate={formData.exchangeRate}
          canOverrideCost={isAdmin}
        />
      )}

      {/* Dialog: Shift Downtime Event */}
      {isLogEventDialogOpen && (
        <LogEventDialog
          isOpen={isLogEventDialogOpen}
          onOpenChange={setIsLogEventDialogOpen}
          selectedOp={selectedOp}
          form={logEventForm}
          setForm={setLogEventForm}
          onSave={handleSaveLogEvent}
        />
      )}

      {/* Dialog: Floor Pallet & Step Execution Report */}
      {isPalletReportDialogOpen && (
        <PalletReportDialog
          shiftSchedule={shiftSchedule}
          profile={profileOf(selectedOp)}
          unit={stepUnit(
            resolveMachine(selectedOp, storeMachines),
            useWorkspaceStore.getState().workRates.find((r) => r.id === selectedOp.workRateId)?.unit
          )}
          isOpen={isPalletReportDialogOpen}
          onOpenChange={(open) => {
            setIsPalletReportDialogOpen(open);
            if (!open) setEditingPalletEvent(null);
          }}
          selectedOp={selectedOp}
          allOperations={operations}
          previousOp={(() => {
            const idx = operations.findIndex((o) => o.id === selectedOp.id);
            return idx > 0 ? operations[idx - 1] : undefined;
          })()}
          previousOpGoodOutput={(() => {
            const idx = operations.findIndex((o) => o.id === selectedOp.id);
            if (idx <= 0) return 0;
            const prev = operations[idx - 1];
            return stepGoodOutput(prev, shiftEvents.filter((ev) => ev.opId === prev.id));
          })()}
          existingOpEvents={selectedOpEvents.filter((ev) => ev.type === "Run")}
          piecesPerSheet={activePrintPlan.piecesPerSheet}
          editingEvent={editingPalletEvent}
          onSaveEvent={handleSavePalletEvent}
        />
      )}

      {askDialog.dialog}

      {/* Dialog: Machine Downtime / Prostoy Log */}
      {isDowntimeDialogOpen && (
        <DowntimeLogDialog
          shiftSchedule={shiftSchedule}
          isOpen={isDowntimeDialogOpen}
          onOpenChange={(open) => {
            setIsDowntimeDialogOpen(open);
            if (!open) setEditingDowntimeEvent(null);
          }}
          selectedOp={selectedOp}
          editingDowntime={editingDowntimeEvent}
          mode={downtimeDialogMode}
          onSaveDowntime={handleSaveDowntime}
        />
      )}


      {/* Unified Order Passport / Job Ticket Dialog */}
      {isJobTicketOpen && (
        <JobTicketDialog
          isOpen={isJobTicketOpen}
          onOpenChange={setIsJobTicketOpen}
          workOrderId={data.docNo || tab.id}
          formData={{ ...formData, skuArtworks }}
          activeSpec={activeSpec}
          activeMachine={activeMachine}
          operations={operations.map((op) => {
            const profile = profileOf(op);
            return { ...op, plannedQty: planInUnit(Number(formData.quantity) || 0, profile), planUnit: profile.unit };
          })}
          materials={currentRecipeMaterials}
          shiftEvents={shiftEvents}
        />
      )}

      {/* Telegram Buyurtmalar Guruhi Dialog */}
      {isTelegramOrdersModalOpen && (
        <TelegramOrdersGroupModal
          isOpen={isTelegramOrdersModalOpen}
          onClose={() => setIsTelegramOrdersModalOpen(false)}
          workOrderId={data.id || data.docNo || tab.id}
          orderNumber={data.docNo || tab.id}
          customerName={formData.customer}
          productName={formData.product}
          quantity={formData.quantity}
          unit={formData.unit}
          paperStock={formData.paperStock}
          coating={formData.coating}
          lamination={formData.lamination}
          embellishment={formData.embellishment}
          width={formData.width}
          height={formData.height}
          status={formData.status}
          stage={formData.stage}
          deadline={formData.deadline}
          telegramMeta={(data as any).telegramMeta}
          onSuccess={(meta) => {
            if (meta) {
              updateTabData(tab.id, { telegramMeta: meta });
            }
          }}
        />
      )}

      {/* Quick Packaging Dialog */}
      {isPackagingOpen && (
        <PackagingDialog
          isOpen={isPackagingOpen}
          onOpenChange={setIsPackagingOpen}
          workOrderNo={data.docNo || tab.id}
          clientOrderNo={formData.linkedOrderId}
          customer={formData.customer}
          product={formData.product}
          targetQuantity={formData.quantity}
          unit={formData.unit}
          sizes={formData.sizes}
          existingPackaging={formData.packagingData}
          producedQty={getProducedOutputQty(operations, shiftEvents)}
          routeFinished={isProductionRouteFinished(operations)}
          onHandOver={handleHandOverPackaging}
          onSavePackaging={(summary, markComplete) => void handleSavePackaging(summary, markComplete)}
          onOpenPrintModal={(summary) => {
            handleFieldChange("packagingData", summary);
            setIsLabelPrintOpen(true);
          }}
        />
      )}

      {/* Box Label Passport Print Modal (100x150 mm) */}
      {isLabelPrintOpen && (
        <BoxLabelPrintModal
          isOpen={isLabelPrintOpen}
          onOpenChange={setIsLabelPrintOpen}
          workOrderNo={data.docNo || tab.id}
          clientOrderNo={formData.linkedOrderId}
          customer={formData.customer}
          product={formData.product}
          boxes={formData.packagingData?.boxes || []}
          totalBoxes={formData.packagingData?.totalBoxes || 0}
        />
      )}

      {/* Lightbox for Sample Proof */}
      {isLightboxOpen && (
        <ImageLightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          src={getDisplayImageUrl(formData.photoUrl)}
          alt={formData.product || "Sample Proof"}
          title={`${tab.documentData?.docNo || tab.id}: Sample Proof`}
          subtitle={`${formData.product} • ${formData.customer} (${formData.department})`}
        />
      )}

      {/* Save As Specification Dialog */}
      {isSaveSpecDialogOpen && (
        <SaveSpecDialog
          isOpen={isSaveSpecDialogOpen}
          onOpenChange={setIsSaveSpecDialogOpen}
          department={formData.department}
          currentRecipeCode={formData.recipe}
          currentRecipeName={activeSpec?.name}
          materials={currentBomItems}
          operations={operations}
          onSaveSpec={handleSaveAsNewSpec}
        />
      )}

      {/* ── Delete / Cancel Work Order Modal ── */}
      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => !isDeleting && setIsDeleteModalOpen(open)}>
        <DialogContent className="max-w-md p-5 bg-card border border-border">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-2.5 text-destructive">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {tOrder("deleteModalTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              {tOrder("documentLabel")}: <strong className="font-mono text-foreground font-semibold">{savedDocNoRef.current || docNo || tab.id}</strong> — {formData.customer} ({formData.product})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {formData.status === "Draft" || !formData.status || formData.status === "Active" ? (
              <div className="space-y-2">
                <label className="font-medium text-foreground block">{tOrder("selectActionType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteMode("hard_delete")}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-colors space-y-1 ${
                      deleteMode === "hard_delete"
                        ? "border-destructive bg-destructive/10 text-destructive font-medium"
                        : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Trash2 className="size-3.5" />
                      <span>{tOrder("hardDelete")}</span>
                    </div>
                    <div className="text-[10px] opacity-80 leading-tight">
                      {tOrder("hardDeleteDesc")}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteMode("cancel")}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-colors space-y-1 ${
                      deleteMode === "cancel"
                        ? "border-amber-600 dark:border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
                        : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      <span>{tOrder("cancelOrder")}</span>
                    </div>
                    <div className="text-[10px] opacity-80 leading-tight">
                      {tOrder("cancelOrderDesc")}
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded bg-muted/40 border border-border text-muted-foreground leading-relaxed">
                {tOrder("cancelOnlyNotice", { status: formData.status })}
              </div>
            )}

            {deleteMode === "cancel" && (
              <div className="space-y-1.5 pt-1">
                <label className="font-medium text-foreground text-xs block">
                  {tOrder("cancelReasonLabel")}
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={tOrder("cancelReasonPlaceholder")}
                  className="w-full h-8 px-2.5 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className="text-xs h-7 px-3"
            >
              {tOrder("close")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs h-7 px-3 gap-1.5"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>{deleteMode === "hard_delete" ? tOrder("btnHardDelete") : tOrder("btnCancelOrder")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
