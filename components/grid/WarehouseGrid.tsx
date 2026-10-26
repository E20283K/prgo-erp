"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item, 
  GridSelection, 
  CompactSelection, 
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Download, 
  Printer, 
  Search, 
  Check,
  Lock,
  FileText,
  Save,
  X,
  Scissors,
  Camera,
  ArrowDownToLine,
  Truck,
  Boxes,
  Building2,
  DollarSign,
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { ReturnOffcutDialog } from "./ReturnOffcutDialog";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { MaterialImageModal, type MaterialImagePreviewData } from "@/components/documents/MaterialImageModal";
import { MaterialImageUploadDialog } from "@/components/documents/MaterialImageUploadDialog";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FieldCombobox, type ComboboxOption } from "@/components/ui/field-combobox";

// ─── Standard Units & Classifiers ───────────────────────────────────────────

const DEFAULT_UNITS: ComboboxOption[] = [
  { value: "sheets", label: "sheets (varaq)" },
  { value: "kg", label: "kg (kilogramm)" },
  { value: "pcs", label: "pcs (dona)" },
  { value: "rolls", label: "rolls (rulon)" },
  { value: "drums", label: "drums (bochka)" },
  { value: "liters", label: "liters (litr)" },
  { value: "bottles", label: "bottles (flakon)" },
  { value: "spools", label: "spools (bobina)" },
  { value: "m²", label: "m² (kvadrat metr)" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface WarehouseGridProps {
  type: string; // "stock-balance" | "requirements" | "movements" | "inventory" | "receipts" | "shipments" | "locations" | "finished-goods"
}

export function WarehouseGrid({ type }: WarehouseGridProps) {
  const tCommon = useTranslations("Common");
  const {
    updateGridStats,
    theme,
    warehouseShipments,
    warehouseStock,
    warehouseMovements,
    warehouseReceipts,
    warehousesList,
    finishedGoods,
    inventoryCounts,
    crmCustomers,
    loadWarehouseStock,
    loadWarehouseMovements,
    loadWarehouseReceipts,
    loadWarehouseShipments,
    loadWarehouses,
    loadFinishedGoods,
    loadInventoryCounts,
    upsertWarehouseStockAsync,
    upsertWarehouseMovementAsync,
    upsertWarehouseReceiptAsync,
    upsertWarehouseShipmentAsync,
    upsertWarehouseAsync,
    upsertFinishedGoodAsync,
    upsertInventoryCountAsync,
    upsertWarehouseStock,
    addWarehouseShipment,
    updateWarehouseShipmentStatus,
    deliveryActs,
    openTab,
    productionQueue,
  } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [rowsData, setRowsData] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [isOffcutDialogOpen, setIsOffcutDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sheetMode, setSheetMode] = useState<'view' | 'create'>('view');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [previewMaterial, setPreviewMaterial] = useState<MaterialImagePreviewData | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);
  const [uploadTargetRecord, setUploadTargetRecord] = useState<any | null>(null);

  const comboboxFields: Record<string, ComboboxOption[]> = useMemo(() => {
    const locOptions: ComboboxOption[] = warehousesList.map((w: any) => ({
      value: w.name,
      label: w.name,
    }));
    const custOptions: ComboboxOption[] = crmCustomers.map((c: any) => ({
      value: c.name,
      label: c.name,
    }));
    const matOptions: ComboboxOption[] = warehouseStock.map((s: any) => ({
      value: s.name,
      label: `${s.name} (${s.sku})`,
    }));

    return {
      material: matOptions,
      from: locOptions,
      to: locOptions,
      location: locOptions,
      customer: custOptions,
      unit: DEFAULT_UNITS,
    };
  }, [warehousesList, crmCustomers, warehouseStock]);

  // Blank templates for each record type
  const blankTemplates: Record<string, Record<string, string>> = {
    'movements': {
      date: new Date().toISOString().split('T')[0],
      material: '',
      quantity: '',
      receivedQty: '0',
      unit: 'sheets',
      from: '',
      to: '',
      reason: '',
      operator: '',
      status: 'Pending',
    },
    'receipts': {
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      material: '',
      quantity: '',
      unit: 'sheets',
      location: '',
      poNumber: '',
      receivedBy: '',
      status: 'Received',
    },
    'shipments': {
      date: new Date().toISOString().split('T')[0],
      customer: '',
      deliveryActId: 'SF-8001',
      workOrder: '',
      product: '',
      quantity: '',
      unit: 'pcs',
      from: '',
      carrier: '',
      trackingNo: '',
      status: 'Packed',
    },
    'inventory': {
      date: new Date().toISOString().split('T')[0],
      location: '',
      material: '',
      systemQty: '',
      actualQty: '',
      variance: '0',
      unit: 'sheets',
      countedBy: '',
      status: 'Matched',
    },
    'locations': {
      name: '',
      type: '',
      address: '',
      zones: '',
      totalSKUs: '0',
      capacity: '0%',
      manager: '',
      status: 'Active',
    },
    'stock-balance': {
      sku: '',
      name: '',
      category: 'Paper & Board',
      location: 'Rack A-01 (Main Paper Hall)',
      stockLevel: '',
      reserved: '0',
      available: '',
      unit: 'sheets',
      lastReceived: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      imageUrl: '',
    },
  };

  const handleCreateNew = () => {
    if (type === "receipts") {
      const draftId = `draft-rcv-${Date.now()}`;
      openTab({
        id: draftId,
        title: "Yangi kirim hujjati",
        type: "warehouse-receipt",
        module: "warehouse",
        isUnsaved: false,
        documentData: {
          id: draftId,
          receiptNumber: "",
          date: new Date().toISOString().split("T")[0],
          supplier: "",
          status: "Draft",
          items: [],
        },
      });
      return;
    }
    if (type === "shipments") {
      const draftId = `draft-shp-${Date.now()}`;
      openTab({
        id: draftId,
        title: "Yangi ombor chiqimi",
        type: "warehouse-shipment",
        module: "warehouse",
        isUnsaved: false,
        documentData: {
          id: draftId,
          shipmentNumber: "",
          date: new Date().toISOString().split("T")[0],
          status: "Draft",
        },
      });
      return;
    }
    if (type === "finished-goods") {
      const draftId = `draft-shp-${Date.now()}`;
      openTab({
        id: draftId,
        title: "Zaxiradan Chiqim (Qoralama)",
        type: "warehouse-shipment",
        module: "warehouse",
        isUnsaved: false,
        documentData: {
          id: draftId,
          shipmentNumber: "",
          date: new Date().toISOString().split("T")[0],
          status: "Draft",
          notes: "Tayyor mahsulot (mijoz zaxirasi) omboridan chiqim",
        },
      });
      return;
    }
    if (type === "stock-balance") {
      const newSku = `MAT-${Date.now().toString().slice(-4)}`;
      openTab({
        id: `stock-${newSku}`,
        title: `${newSku}: Yangi Xomashyo`,
        type: "warehouse-stock",
        module: "warehouse",
        isUnsaved: false,
        documentData: {
          sku: newSku,
          name: "",
          category: "Paper & Board",
          unit: "sheets",
          sheetFormat: "",
          grammage: undefined,
          stockLevel: 0,
          reserved: 0,
          available: 0,
          reorder: 0,
          unitPriceUsd: 0,
          location: warehousesList[0]?.name || "",
          status: "In Stock",
          imageUrl: undefined,
        },
      });
      return;
    }
    const template = blankTemplates[type] ?? {};
    setFormData(template);
    setSelectedRecord(null);
    setSheetMode('create');
  };

  const handleSave = async () => {
    const prefixes: Record<string, string> = {
      movements: 'MOV', receipts: 'RCV', shipments: 'SHP',
      inventory: 'IC', locations: 'LOC', 'stock-balance': 'MAT',
      'finished-goods': 'FG',
    };
    const prefix = prefixes[type] ?? 'REC';
    const newId = `${prefix}-${String(Date.now()).slice(-4)}`;
    const newRow = { id: newId, ...formData };

    if (type === 'shipments') {
      await upsertWarehouseShipmentAsync(newRow);
    } else if (type === 'stock-balance') {
      await upsertWarehouseStockAsync(newRow);
    } else if (type === 'receipts') {
      await upsertWarehouseReceiptAsync(newRow);
    } else if (type === 'movements') {
      await upsertWarehouseMovementAsync(newRow);
    } else if (type === 'inventory') {
      await upsertInventoryCountAsync(newRow);
    } else if (type === 'locations') {
      await upsertWarehouseAsync(newRow);
    } else if (type === 'finished-goods') {
      await upsertFinishedGoodAsync(newRow);
    }

    setSheetMode('view');
    setFormData({});
    setSelectedRecord(newRow);
  };

  const handleOpenSheet = (record: any) => {
    if (type === "requirements") {
      openTab({
        id: record.workOrderId,
        title: `${record.workOrderId}: Buyurtma`,
        type: "work-order",
        module: "production",
      });
      return;
    }
    if (type === "receipts") {
      openTab({
        id: record.id,
        title: `${record.id}: ${record.supplier || "Ombor Kirimi"}`,
        type: "warehouse-receipt",
        module: "warehouse",
        documentData: record,
      });
      return;
    }
    if (type === "shipments") {
      openTab({
        id: record.id,
        title: `${record.id}: ${record.customer || "Ombor Chiqimi"}`,
        type: "warehouse-shipment",
        module: "warehouse",
        documentData: record,
      });
      return;
    }
    if (type === "stock-balance") {
      openTab({
        id: `stock-${record.sku}`,
        title: `${record.sku}: ${record.name}`,
        type: "warehouse-stock",
        module: "warehouse",
        documentData: record,
      });
      return;
    }
    if (type === "finished-goods") {
      const custName = (record.customerName || record.customer || "").trim().toLowerCase();
      const matchedCust = crmCustomers.find(
        (c) =>
          c.id === record.customerId ||
          c.name.trim().toLowerCase() === custName ||
          c.name.toLowerCase().includes(custName) ||
          custName.includes(c.name.toLowerCase())
      );
      if (matchedCust) {
        openTab({
          id: matchedCust.id,
          title: `${matchedCust.id}: ${matchedCust.name}`,
          type: "customer",
          module: "crm",
          activeLevel3Tab: "orders",
          documentData: matchedCust,
        });
        return;
      }
      if (record.workOrderId) {
        openTab({
          id: record.workOrderId,
          title: `${record.workOrderId}: ${record.productName || record.product}`,
          type: "work-order",
          module: "production",
          activeLevel3Tab: "overview",
          documentData: {
            docNo: record.workOrderId,
            customer: record.customerName || record.customer,
            product: record.productName || record.product,
          },
        });
        return;
      }
    }
    setSheetMode('view');
    setSelectedRecord(record);
  };

  const handleCreateReceiptFromRequirements = () => {
    const selectedIndices = selection.rows.toArray();
    const targetRows = selectedIndices.length > 0 
      ? selectedIndices.map((idx) => rowsData[idx]).filter(Boolean)
      : rowsData.filter((r) => r.deficitQty > 0);

    if (targetRows.length === 0) return;

    const newId = `RCV-${Date.now().toString().slice(-4)}`;
    openTab({
      id: newId,
      title: `${newId}: Defitsit Kirim Hujjati`,
      type: "warehouse-receipt",
      module: "warehouse",
      isUnsaved: false,
      documentData: {
        id: newId,
        date: new Date().toISOString().split("T")[0],
        supplier: "",
        status: "Draft",
        items: targetRows.map((r, idx) => ({
          id: `line-${Date.now()}-${idx}`,
          workOrderId: r.workOrderId,
          sku: r.materialSku || `MAT-${100 + idx}`,
          name: r.materialName,
          category: r.category || "Paper & Board",
          sheetFormat: r.sheetFormat || "",
          grammage: r.grammage || 0,
          quantity: r.deficitQty || r.requiredQty || 0,
          unit: r.unit || "sheets",
          unitPriceUsd: 0,
        })),
      },
    });
  };


  const columns = useMemo(() => {
    let cols: GridColumn[] = [];
    if (type === 'finished-goods') {
      cols = [
        { id: 'id', title: 'Partiya / WO №', width: 125, icon: GridColumnIcon.HeaderReference },
        { id: 'customerName', title: 'Buyurtmachi (Mijoz)', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'productName', title: 'Tayyor Mahsulot Nomi', width: 280, icon: GridColumnIcon.HeaderString },
        { id: 'completionDate', title: 'Ishlab chiqarildi', width: 115, icon: GridColumnIcon.HeaderDate },
        { id: 'orderedQty', title: 'Buyurtma (Tiraj)', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'producedQty', title: 'Chiqarildi (Fakt)', width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: 'shippedQty', title: 'Yuklandi (SF)', width: 105, icon: GridColumnIcon.HeaderNumber },
        { id: 'stockQty', title: 'Ombordagi Zaxira', width: 135, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Birlik', width: 75, icon: GridColumnIcon.HeaderString },
        { id: 'totalStockValue', title: 'Zaxira Qiymati ($)', width: 125, icon: GridColumnIcon.HeaderNumber },
        { id: 'location', title: 'Saqlash Joyi (Rampa/Pallet)', width: 240, icon: GridColumnIcon.HeaderString },
        { id: 'daysInStock', title: 'Muddat', width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: 'status', title: 'Holati', width: 130, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'stock-balance') {
      cols = [
        { id: 'image', title: tCommon('image'), width: 56, icon: GridColumnIcon.HeaderImage },
        { id: 'sku', title: 'SKU', width: 110, icon: GridColumnIcon.HeaderReference },
        { id: 'name', title: 'Material Name', width: 290, icon: GridColumnIcon.HeaderString },
        { id: 'category', title: 'Category', width: 155, icon: GridColumnIcon.HeaderLookup },
        { id: 'sheetFormat', title: 'Format / Dimensions', width: 130, icon: GridColumnIcon.HeaderString },
        { id: 'location', title: 'Location', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'stockLevel', title: 'Total Stock', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'reserved', title: 'Reserved (WO)', width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: 'available', title: 'Available', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Unit', width: 80, icon: GridColumnIcon.HeaderString },
        { id: 'lastReceived', title: 'Last Received', width: 120, icon: GridColumnIcon.HeaderDate },
        { id: 'status', title: 'Stock Status', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'movements') {
      cols = [
        { id: 'id', title: 'Move ID', width: 110, icon: GridColumnIcon.HeaderReference },
        { id: 'date', title: 'Date', width: 110, icon: GridColumnIcon.HeaderDate },
        { id: 'material', title: 'Material', width: 280, icon: GridColumnIcon.HeaderString },
        { id: 'movementType', title: 'Operation Type', width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: 'quantity', title: 'Sent Qty', width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: 'receivedQty', title: 'Rcvd Qty', width: 85, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Unit', width: 80, icon: GridColumnIcon.HeaderString },
        { id: 'from', title: 'From', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'to', title: 'To', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'reason', title: 'Reason / Work Order', width: 300, icon: GridColumnIcon.HeaderTextTemplate },
        { id: 'operator', title: 'Operator', width: 140, icon: GridColumnIcon.HeaderString },
        { id: 'status', title: 'Status', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'inventory') {
      cols = [
        { id: 'id', title: 'Count ID', width: 130, icon: GridColumnIcon.HeaderReference },
        { id: 'date', title: 'Date', width: 110, icon: GridColumnIcon.HeaderDate },
        { id: 'location', title: 'Location', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'material', title: 'Material', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'systemQty', title: 'System Qty', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'actualQty', title: 'Actual Qty', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'variance', title: 'Variance', width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Unit', width: 80, icon: GridColumnIcon.HeaderString },
        { id: 'countedBy', title: 'Counted By', width: 140, icon: GridColumnIcon.HeaderString },
        { id: 'status', title: 'Result', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'requirements') {
      cols = [
        { id: 'workOrderId', title: 'Buyurtma № (WO)', width: 135, icon: GridColumnIcon.HeaderReference },
        { id: 'customer', title: 'Mijoz', width: 180, icon: GridColumnIcon.HeaderString },
        { id: 'product', title: 'Mahsulot', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'materialName', title: 'Talab Qilingan Xomashyo', width: 260, icon: GridColumnIcon.HeaderString },
        { id: 'requiredQty', title: 'Reja Miqdori', width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: 'availableQty', title: 'Omborda Bor', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'deficitQty', title: 'Yetishmayotgan (Defitsit)', width: 145, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Birlik', width: 75, icon: GridColumnIcon.HeaderString },
        { id: 'deadline', title: 'Muddati (Deadline)', width: 115, icon: GridColumnIcon.HeaderDate },
        { id: 'status', title: 'Holati', width: 115, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'receipts') {
      cols = [
        { id: 'id', title: 'Receipt ID', width: 110, icon: GridColumnIcon.HeaderReference },
        { id: 'date', title: 'Date', width: 110, icon: GridColumnIcon.HeaderDate },
        { id: 'supplier', title: 'Supplier', width: 200, icon: GridColumnIcon.HeaderString },
        { id: 'material', title: 'Material', width: 280, icon: GridColumnIcon.HeaderString },
        { id: 'quantity', title: 'Qty', width: 90, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Unit', width: 80, icon: GridColumnIcon.HeaderString },
        { id: 'location', title: 'Destination', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'poNumber', title: 'PO Number', width: 140, icon: GridColumnIcon.HeaderReference },
        { id: 'receivedBy', title: 'Received By', width: 140, icon: GridColumnIcon.HeaderString },
        { id: 'status', title: 'Status', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'shipments') {
      cols = [
        { id: 'id', title: 'Shipment ID', width: 110, icon: GridColumnIcon.HeaderReference },
        { id: 'date', title: 'Date', width: 105, icon: GridColumnIcon.HeaderDate },
        { id: 'shipmentType', title: 'Chiqim turi', width: 155, icon: GridColumnIcon.HeaderLookup },
        { id: 'deliveryActId', title: 'Schet-faktura / TTN', width: 135, icon: GridColumnIcon.HeaderReference },
        { id: 'customer', title: 'Qabul qiluvchi', width: 210, icon: GridColumnIcon.HeaderString },
        { id: 'workOrder', title: 'Buyurtma / Asos', width: 130, icon: GridColumnIcon.HeaderReference },
        { id: 'product', title: 'Mahsulot / Yuk', width: 230, icon: GridColumnIcon.HeaderString },
        { id: 'quantity', title: 'Miqdor', width: 95, icon: GridColumnIcon.HeaderNumber },
        { id: 'from', title: 'Chiqaruvchi ombor', width: 200, icon: GridColumnIcon.HeaderString },
        { id: 'carrier', title: 'Tashuvchi', width: 160, icon: GridColumnIcon.HeaderString },
        { id: 'trackingNo', title: 'Tracking No', width: 120, icon: GridColumnIcon.HeaderString },
        { id: 'status', title: 'Status', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else {
      cols = [
        { id: 'id', title: 'Loc ID', width: 90, icon: GridColumnIcon.HeaderReference },
        { id: 'name', title: 'Location Name', width: 260, icon: GridColumnIcon.HeaderString },
        { id: 'type', title: 'Type', width: 110, icon: GridColumnIcon.HeaderLookup },
        { id: 'address', title: 'Address', width: 300, icon: GridColumnIcon.HeaderString },
        { id: 'zones', title: 'Zones', width: 80, icon: GridColumnIcon.HeaderNumber },
        { id: 'totalSKUs', title: 'SKUs', width: 80, icon: GridColumnIcon.HeaderNumber },
        { id: 'capacity', title: 'Capacity', width: 100, icon: GridColumnIcon.HeaderString },
        { id: 'manager', title: 'Manager', width: 140, icon: GridColumnIcon.HeaderString },
        { id: 'status', title: 'Status', width: 100, icon: GridColumnIcon.HeaderSingleValue },
      ];
    }
    return cols;
  }, [type]);

  // 1. Data Fetching Effect: ONLY runs when 'type' changes or on mount (NEVER loops)
  useEffect(() => {
    loadWarehouses();
    if (type === 'finished-goods') {
      loadFinishedGoods();
    } else if (type === 'shipments') {
      loadWarehouseShipments();
    } else if (type === 'stock-balance') {
      loadWarehouseStock();
    } else if (type === 'movements') {
      loadWarehouseMovements();
    } else if (type === 'receipts') {
      loadWarehouseReceipts();
    } else if (type === 'inventory') {
      loadInventoryCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // 2. Data Synchronization Effect: ONLY copies store data into rowsData without calling any fetch
  useEffect(() => {
    if (type === 'requirements') {
      const defs: any[] = [];
      productionQueue.forEach((q) => {
        if (q.stage === "Completed") return;

        const matchedStock = warehouseStock.find(
          (s) =>
            s.name.toLowerCase().includes(q.product.toLowerCase()) ||
            q.product.toLowerCase().includes(s.name.toLowerCase())
        ) || warehouseStock.find((s) => s.category === "Paper & Board");

        const neededQty = q.plannedSheets || q.quantity || 1000;
        const avail = matchedStock?.available || 0;
        const deficit = Math.max(0, neededQty - avail);

        // Faqat haqiqiy defitsit mavjud bo'lganda (xomashyo yetishmayotganda) ro'yxatda aks etadi
        if (deficit > 0) {
          defs.push({
            id: `DEF-${q.id}`,
            workOrderId: q.id,
            customer: q.customer,
            product: q.product,
            materialSku: matchedStock?.sku || `PAP-${q.id.replace(/\D/g, "").slice(-3) || "REQ"}`,
            materialName: matchedStock?.name || `${q.product} Xomashyosi`,
            category: matchedStock?.category || "Paper & Board",
            sheetFormat: matchedStock?.sheetFormat || "700×1000",
            grammage: matchedStock?.grammage || 250,
            requiredQty: neededQty,
            availableQty: avail,
            deficitQty: deficit,
            unit: matchedStock?.unit || q.unit || "sheets",
            deadline: q.deadline,
            priority: q.priority,
            status: "Deficit",
          });
        }
      });
      setRowsData(defs);
    } else if (type === 'finished-goods') {
      setRowsData(finishedGoods);
    } else if (type === 'shipments') {
      setRowsData(warehouseShipments);
    } else if (type === 'stock-balance') {
      setRowsData(warehouseStock);
    } else if (type === 'movements') {
      setRowsData(warehouseMovements);
    } else if (type === 'receipts') {
      setRowsData(warehouseReceipts);
    } else if (type === 'inventory') {
      setRowsData(inventoryCounts);
    } else if (type === 'locations') {
      setRowsData(warehousesList);
    }
  }, [
    type,
    productionQueue,
    finishedGoods,
    warehouseShipments,
    warehouseStock,
    warehouseMovements,
    warehouseReceipts,
    inventoryCounts,
    warehousesList,
  ]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rowsData.filter((r) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      let matchesCategory = true;
      if (type === 'stock-balance' && categoryFilter !== "ALL") {
        if (categoryFilter === "Offcuts") {
          matchesCategory = Boolean(r.isOffcut || r.category === "Offcuts & Scraps");
        } else {
          matchesCategory = r.category === categoryFilter;
        }
      } else if (type === 'movements' && categoryFilter !== "ALL") {
        if (categoryFilter === "Offcuts") {
          matchesCategory = Boolean(r.isOffcut || r.movementType === "CuttingReturn");
        } else if (categoryFilter === "ProductionIssue") {
          matchesCategory = r.movementType === "ProductionIssue";
        } else if (categoryFilter === "WriteOff") {
          matchesCategory = r.movementType === "WriteOff";
        } else if (categoryFilter === "Transfers") {
          matchesCategory = r.movementType === "Transfer" || !r.movementType;
        }
      } else if (type === 'shipments' && categoryFilter !== "ALL") {
        if (categoryFilter === "CustomerDelivery") {
          matchesCategory = !r.shipmentType || r.shipmentType === "CustomerDelivery";
        } else {
          matchesCategory = r.shipmentType === categoryFilter;
        }
      }
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [rowsData, searchFilter, statusFilter, categoryFilter, type]);

  useEffect(() => {
    const selectedRowsCount = selection.rows.length;
    let coords = "R1:C1";
    if (selection.current?.cell) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, filteredRows.length, coords);
  }, [selection, filteredRows.length, columns, updateGridStats]);


  // Double-click on row / cell opens document sheet or image preview
  const handleCellActivated = useCallback((cell: Item) => {
    const [col, row] = cell;
    const rowData = filteredRows[row];
    const column = columns[col];
    if (rowData) {
      if (column?.id === "image") {
        if (rowData.imageUrl) {
          setPreviewMaterial({
            imageUrl: rowData.imageUrl,
            title: rowData.name || rowData.sku,
            sku: rowData.sku,
            category: rowData.category,
            spec: rowData.sheetFormat ? `${rowData.sheetFormat} mm` : rowData.cutDimensions,
            stock: rowData.available !== undefined ? rowData.available.toLocaleString() : rowData.stockLevel,
            unit: rowData.unit,
            location: rowData.location,
            supplier: rowData.supplier,
            status: rowData.status,
          });
        } else {
          setUploadTargetRecord(rowData);
          setIsUploadDialogOpen(true);
        }
        return;
      }
      handleOpenSheet(rowData);
    }
  }, [filteredRows, columns]);

  const handleConfirm = () => {
    if (!selectedRecord) return;
    const targetStatus = type === 'shipments' ? 'Delivered' : 'Completed';

    if (type === 'shipments') {
      updateWarehouseShipmentStatus(selectedRecord.id, 'Delivered');
    } else {
      setRowsData(prev => prev.map(r => {
        if (r.id === selectedRecord.id) {
          return {
            ...r,
            status: targetStatus,
            receivedQty: r.quantity !== undefined ? r.quantity : r.receivedQty,
          };
        }
        return r;
      }));
    }
    
    setSelectedRecord((prev: any) => prev ? { ...prev, status: targetStatus, receivedQty: prev.quantity !== undefined ? prev.quantity : prev.receivedQty } : null);
    setIsConfirmAlertOpen(false);
  };

  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const rowData = filteredRows[row];
    if (!rowData) {
      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    }

    const column = columns[col];
    const val = rowData[column.id as keyof typeof rowData];

    // Image column for stock-balance
    if (column.id === "image") {
      if (rowData.imageUrl) {
        return {
          kind: GridCellKind.Image,
          data: [rowData.imageUrl],
          displayData: [rowData.imageUrl],
          allowOverlay: true,
        };
      }
      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: false,
      };
    }

    // Status column — color-coded
    if (column.id === "status") {
      const positives = ["In Stock", "Completed", "Received", "Accepted", "Delivered", "Matched", "Active", "Ready for Dispatch", "Partially Shipped", "Covered"];
      const negatives = ["Critical", "Out of Stock", "Shortage", "Quarantine", "Inactive", "Deficit"];
      const warnings = ["Low Stock", "In Transit", "Pending", "Inspecting", "Packed", "Dispatched", "Surplus", "Reserved"];

      let color = isDark ? "#facc15" : "#a16207"; // default warning
      if (positives.includes(String(val))) color = isDark ? "#4ade80" : "#15803d";
      else if (negatives.includes(String(val))) color = isDark ? "#f87171" : "#b91c1c";

      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
        themeOverride: { textDark: color, baseFontStyle: "600 12px sans-serif" },
      };
    }

    // Variance column — color-coded
    if (column.id === "variance" && typeof val === "number") {
      const color = val > 0
        ? (isDark ? "#4ade80" : "#15803d")
        : val < 0
          ? (isDark ? "#f87171" : "#b91c1c")
          : (isDark ? "#a1a1aa" : "#71717a");
      return {
        kind: GridCellKind.Number,
        data: val,
        displayData: val > 0 ? `+${val}` : String(val),
        allowOverlay: false,
        contentAlign: "right",
        themeOverride: { textDark: color, baseFontStyle: "600 12px monospace" },
      };
    }

    // Capacity column — color-coded
    if (column.id === "capacity" && typeof val === "string") {
      const pct = parseInt(val);
      const color = pct > 80
        ? (isDark ? "#f87171" : "#b91c1c")
        : pct > 60
          ? (isDark ? "#facc15" : "#a16207")
          : (isDark ? "#4ade80" : "#15803d");
      return {
        kind: GridCellKind.Text,
        data: val,
        displayData: val,
        allowOverlay: false,
        contentAlign: "right",
        themeOverride: { textDark: color, baseFontStyle: "600 12px sans-serif" },
      };
    }

    // Shipment Type column
    if (column.id === "shipmentType") {
      const sType = rowData.shipmentType || "CustomerDelivery";
      const configs: Record<string, { label: string; dark: string; light: string }> = {
        CustomerDelivery: { label: "🛍️ Mijozga", dark: "#60a5fa", light: "#1d4ed8" },
        BranchTransfer: { label: "🚛 Filialga", dark: "#38bdf8", light: "#0284c7" },
        Outsourcing: { label: "🔄 Subpudrat", dark: "#c084fc", light: "#7e22ce" },
        VendorReturn: { label: "↩️ Qaytarish", dark: "#f87171", light: "#dc2626" },
        MaterialSale: { label: "📦 Sotuv", dark: "#fbbf24", light: "#d97706" },
      };
      const info = configs[sType] || { label: String(sType), dark: "#94a3b8", light: "#475569" };
      return {
        kind: GridCellKind.Text,
        data: info.label,
        displayData: info.label,
        allowOverlay: false,
        themeOverride: {
          textDark: isDark ? info.dark : info.light,
          baseFontStyle: "600 12px sans-serif",
        },
      };
    }

    // Movement Type column
    if (column.id === "movementType") {
      const mType = rowData.movementType;
      let label = "🔄 Tokchalararo";
      let dark = "#a78bfa";
      let light = "#6d28d9";
      if (mType === "CuttingReturn" || rowData.isOffcut) {
        label = "✂️ Delovoy Otxod";
        dark = "#fbbf24";
        light = "#b45309";
      } else if (mType === "ProductionIssue") {
        label = "🏭 Sexga sarf";
        dark = "#38bdf8";
        light = "#0369a1";
      } else if (mType === "WriteOff") {
        label = "⚠️ Spisaniye (Brak)";
        dark = "#f87171";
        light = "#dc2626";
      }
      return {
        kind: GridCellKind.Text,
        data: label,
        displayData: label,
        allowOverlay: false,
        themeOverride: {
          textDark: isDark ? dark : light,
          baseFontStyle: "600 12px sans-serif",
        },
      };
    }

    // Material Name column - highlight offcuts
    if (column.id === "name" && rowData.isOffcut) {
      const offcutLabel = `✂️ ${val}`;
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: offcutLabel,
        allowOverlay: true,
        themeOverride: { textDark: isDark ? "#fbbf24" : "#b45309", baseFontStyle: "600 12px sans-serif" },
      };
    }

    // Sheet Format column
    if (column.id === "sheetFormat") {
      const fmt = String(val || rowData.cutDimensions || "-");
      return {
        kind: GridCellKind.Text,
        data: fmt,
        displayData: fmt,
        allowOverlay: true,
        themeOverride: rowData.isOffcut
          ? { textDark: isDark ? "#fbbf24" : "#b45309", baseFontStyle: "600 12px monospace" }
          : { baseFontStyle: "12px monospace" },
      };
    }

    if (column.id === "stockQty") {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: `${num.toLocaleString()} ${rowData.unit || "dona"}`,
        allowOverlay: false,
        contentAlign: "right",
        themeOverride: num > 0 ? {
          textDark: isDark ? "#4ade80" : "#15803d",
          baseFontStyle: "bold 12px monospace",
        } : undefined,
      };
    }

    // Requirements & Deficit columns
    if (column.id === "deficitQty") {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: num > 0 ? `-${num.toLocaleString()} ${rowData.unit || ""}` : "0",
        allowOverlay: false,
        contentAlign: "right",
        themeOverride: {
          textDark: num > 0 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#4ade80" : "#15803d"),
          baseFontStyle: "bold 12px monospace",
        },
      };
    }

    if (column.id === "requiredQty" || column.id === "availableQty") {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: `${num.toLocaleString()} ${rowData.unit || ""}`,
        allowOverlay: false,
        contentAlign: "right",
      };
    }

    if (column.id === "totalStockValue") {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: `$${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        allowOverlay: false,
        contentAlign: "right",
        themeOverride: {
          textDark: isDark ? "#93c5fd" : "#1d4ed8",
          baseFontStyle: "600 12px monospace",
        },
      };
    }

    if (column.id === "daysInStock") {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: `${num} kun`,
        allowOverlay: false,
        contentAlign: "right",
      };
    }

    if (column.id && ["orderedQty", "producedQty", "shippedQty"].includes(column.id)) {
      const num = Number(val || 0);
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: num.toLocaleString(),
        allowOverlay: false,
        contentAlign: "right",
      };
    }

    return {
      kind: typeof val === "number" ? GridCellKind.Number : GridCellKind.Text,
      data: val,
      displayData: typeof val === "number" ? val.toLocaleString() : String(val),
      allowOverlay: true,
      contentAlign: typeof val === "number" ? "right" : "left",
    };
  }, [filteredRows, columns, isDark]);

  const finishedGoodsStats = useMemo(() => {
    const totalStockQty = finishedGoods.reduce((sum, g) => sum + (Number(g.stockQty) || 0), 0);
    const totalShippedQty = finishedGoods.reduce((sum, g) => sum + (Number(g.shippedQty) || 0), 0);
    const totalProducedQty = finishedGoods.reduce((sum, g) => sum + (Number(g.producedQty) || 0), 0);
    const totalStockValue = finishedGoods.reduce(
      (sum, g) =>
        sum +
        (Number(g.totalStockValue) ||
          (Number(g.stockQty) || 0) * (Number(g.costPricePerUnit) || 0)),
      0
    );
    const customersWithStock = new Set(
      finishedGoods
        .filter((g) => (Number(g.stockQty) || 0) > 0)
        .map((g) => g.customerName)
    );
    const totalProducts = new Set(finishedGoods.map((g) => g.productName)).size;
    const activeBatches = finishedGoods.filter((g) => (Number(g.stockQty) || 0) > 0).length;

    return {
      totalStockQty,
      totalShippedQty,
      totalProducedQty,
      totalStockValue,
      customerCount: customersWithStock.size,
      totalProducts,
      activeBatches,
    };
  }, [finishedGoods]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rowsData.forEach(r => {
      if (r.status) statuses.add(r.status);
    });
    return Array.from(statuses);
  }, [rowsData]);

  const typeLabels: Record<string, string> = {
    "finished-goods": "finished goods (mijoz zaxirasi)",
    "stock-balance": "stock",
    "movements": "movements",
    "inventory": "inventory counts",
    "receipts": "receipts",
    "shipments": "shipments",
    "locations": "locations",
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
          {/* Toolbar */}
          <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              {type !== 'requirements' && type !== 'finished-goods' && (
                <Button 
                  size="sm" 
                  onClick={handleCreateNew}
                  className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New</span>
                </Button>
              )}

              {type === 'finished-goods' && selection.rows.toArray().length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const selIdx = selection.rows.toArray()[0];
                    const record = filteredRows[selIdx];
                    if (!record) return;
                    const nextNum = 6010 + warehouseShipments.length;
                    const newId = `SHP-${nextNum}`;
                    openTab({
                      id: newId,
                      title: `${newId}: Zaxiradan Chiqim`,
                      type: "warehouse-shipment",
                      module: "warehouse",
                      isUnsaved: false,
                      documentData: {
                        id: newId,
                        date: new Date().toISOString().split("T")[0],
                        status: "Draft",
                        customerName: record.customerName || record.customer,
                        workOrderId: record.workOrderId,
                        notes: `Mijoz zaxirasidan chiqim: ${record.productName}`,
                        items: [
                          {
                            id: `item-${Date.now()}`,
                            sku: record.sku || `PRD-${record.id}`,
                            name: record.productName,
                            quantity: record.stockQty,
                            unit: record.unit || "pcs",
                            unitPrice: record.costPricePerUnit || 0,
                            totalPrice: record.totalStockValue || 0,
                          }
                        ]
                      },
                    });
                  }}
                  className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Zaxiradan chiqim qilish</span>
                </Button>
              )}

              {type === 'movements' && (
                <Button
                  onClick={() => setIsOffcutDialogOpen(true)}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white shadow-none"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Qoldiqni kirim qilish</span>
                </Button>
              )}

              {type === 'requirements' && (
                <Button
                  onClick={handleCreateReceiptFromRequirements}
                  size="sm"
                  title={
                    selection.rows.toArray().length > 0
                      ? `${selection.rows.toArray().length} ta tanlangan xomashyo bo'yicha kirim hujjati yaratish`
                      : "Barcha defitsitlar bo'yicha kirim hujjati yaratish"
                  }
                  className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-none cursor-pointer"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>
                    {selection.rows.toArray().length > 0
                      ? `Kirim qilish (${selection.rows.toArray().length})`
                      : "Kirim qilish"}
                  </span>
                </Button>
              )}

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Stock Balance Category Filters */}
              {type === 'stock-balance' && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setCategoryFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${categoryFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Barcha toifalar
                  </button>
                  <button
                    onClick={() => setCategoryFilter("Offcuts")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "Offcuts" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold shadow-xs border border-amber-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Scissors className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Delovoy Otxodlar</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-amber-500/25 text-amber-800 dark:text-amber-200">
                      {warehouseStock.filter((s) => s.isOffcut).length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("Paper & Board")}
                    className={`px-2 py-0.5 rounded transition-colors ${categoryFilter === "Paper & Board" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Asosiy Qog'ozlar
                  </button>
                </div>
              )}

              {/* Movements Type Filters */}
              {type === 'movements' && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setCategoryFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${categoryFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Barchasi
                  </button>
                  <button
                    onClick={() => setCategoryFilter("Offcuts")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "Offcuts" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold shadow-xs border border-amber-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Scissors className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Delovoy Otxod kirimi</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-amber-500/25 text-amber-800 dark:text-amber-200">
                      {warehouseMovements.filter((m) => m.isOffcut || m.movementType === 'CuttingReturn').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("ProductionIssue")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "ProductionIssue" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold shadow-xs border border-sky-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>Sexga sarf</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-sky-500/20 text-sky-800 dark:text-sky-200">
                      {warehouseMovements.filter((m) => m.movementType === 'ProductionIssue').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("WriteOff")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "WriteOff" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs border border-rose-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>Spisaniye (Brak)</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-rose-500/20 text-rose-800 dark:text-rose-200">
                      {warehouseMovements.filter((m) => m.movementType === 'WriteOff').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("Transfers")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "Transfers" ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold shadow-xs border border-purple-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>Tokchalararo</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-purple-500/20 text-purple-800 dark:text-purple-200">
                      {warehouseMovements.filter((m) => m.movementType === 'Transfer' || (!m.movementType && !m.isOffcut)).length}
                    </span>
                  </button>
                </div>
              )}

              {/* Shipments Type Filters */}
              {type === 'shipments' && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setCategoryFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${categoryFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Barchasi
                  </button>
                  <button
                    onClick={() => setCategoryFilter("CustomerDelivery")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "CustomerDelivery" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>🛍️ Mijozlarga</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-muted-foreground/15">
                      {warehouseShipments.filter((s) => !s.shipmentType || s.shipmentType === "CustomerDelivery").length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("BranchTransfer")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "BranchTransfer" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold shadow-xs border border-sky-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>🚛 Filiallarga</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-sky-500/20 text-sky-800 dark:text-sky-200">
                      {warehouseShipments.filter((s) => s.shipmentType === "BranchTransfer").length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("Outsourcing")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "Outsourcing" ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold shadow-xs border border-purple-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>🔄 Subpudrat</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-purple-500/20 text-purple-800 dark:text-purple-200">
                      {warehouseShipments.filter((s) => s.shipmentType === "Outsourcing").length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCategoryFilter("VendorReturn")}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${categoryFilter === "VendorReturn" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs border border-rose-500/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>↩️ Qaytarish</span>
                    <span className="ml-0.5 px-1 rounded-full text-[9px] bg-rose-500/20 text-rose-800 dark:text-rose-200">
                      {warehouseShipments.filter((s) => s.shipmentType === "VendorReturn").length}
                    </span>
                  </button>
                </div>
              )}

              {type !== 'requirements' && availableStatuses.length > 1 && (
                <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2 py-0.5 rounded transition-colors ${statusFilter === "ALL" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    ALL
                  </button>
                  {availableStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2 py-0.5 rounded transition-colors ${statusFilter === status ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Search ${typeLabels[type] || type}...`}
                  className="pl-7 h-7 text-xs bg-background border-input rounded"
                />
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>{tCommon("export")}</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Printer className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Finished Goods Standalone KPI Cards (Alohida Kartalar) */}
          {type === 'finished-goods' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 px-3 py-2.5 border-b border-border bg-muted/20 shrink-0">
              {/* Card 1: Mas'ul Saqlovdagi Zaxira */}
              <div className="bg-card border border-border rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                    <span>Mas&apos;ul Saqlovdagi Zaxira</span>
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {finishedGoodsStats.totalStockQty.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground font-sans">dona</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Jami chiqarildi: {finishedGoodsStats.totalProducedQty.toLocaleString()} dona
                  </div>
                </div>
                <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>

              {/* Card 2: Jo'natilgan / Yuklangan Mahsulot */}
              <div className="bg-card border border-border rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                    <span>Yuklandi (Chiqim qilingan)</span>
                  </div>
                  <div className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    {finishedGoodsStats.totalShippedQty.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground font-sans">dona</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Hisob-faktura (SF) asosida yetkazildi
                  </div>
                </div>
                <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
              </div>

              {/* Card 3: Zaxirali Mijozlar */}
              <div className="bg-card border border-border rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                    <span>Zaxirali Mijozlar</span>
                  </div>
                  <div className="font-mono text-base font-bold text-foreground">
                    {finishedGoodsStats.customerCount}{" "}
                    <span className="text-xs font-normal text-muted-foreground font-sans">ta mijoz</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {finishedGoodsStats.totalProducts} turdagi tayyor mahsulot
                  </div>
                </div>
                <div className="w-8 h-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              {/* Card 4: Zaxira Balansi Qiymati */}
              <div className="bg-card border border-border rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                    <span>Zaxira Balansi Qiymati</span>
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    ${finishedGoodsStats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {finishedGoodsStats.activeBatches} ta faol partiya balansi
                  </div>
                </div>
                <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 w-full h-full relative" id="warehouse-grid-root">
            <DataEditor
              getCellContent={getContent}
              onCellActivated={handleCellActivated}
              columns={columns}
              rows={filteredRows.length}
              rowMarkers="both"
              freezeColumns={type === 'stock-balance' ? 2 : 1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Slide-out Panel — View & Create modes */}
      <Sheet
        open={sheetMode === 'create' || !!selectedRecord}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null);
            setSheetMode('view');
            setFormData({});
          }
        }}
      >
        <SheetContent className="sm:max-w-[440px] p-0 flex flex-col h-full bg-card">

          {/* ── CREATE MODE ─────────────────────────────────── */}
          {sheetMode === 'create' && (
            <>
              <div className="p-5 border-b border-border flex flex-col gap-3.5 pt-4 pr-12">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base font-semibold">
                      New {typeLabels[type] ? typeLabels[type].replace(/s$/, '') : 'Record'}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                      Fill in the details and click Save to add to the list
                    </SheetDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0 whitespace-nowrap">Draft</Badge>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <Button size="sm" onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-none">
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Record</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSheetMode('view'); setFormData({}); }} className="flex-1 gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                {Object.entries(formData).map(([key, val]) => {
                  if (key === 'status') return null;
                  if (key === 'imageUrl') {
                    const currentImg = val;
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Haqiqiy fotosurat
                        </Label>
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                          <div className="size-14 rounded-md border border-border bg-background overflow-hidden p-1 shrink-0 flex items-center justify-center">
                            {currentImg ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={currentImg} alt="Preview" className="size-full object-contain" />
                            ) : (
                              <Camera className="size-6 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setUploadTargetRecord(null);
                                setIsUploadDialogOpen(true);
                              }}
                              className="h-7 text-xs gap-1.5 w-full justify-center"
                            >
                              <Camera className="size-3.5 text-muted-foreground" />
                              <span>{currentImg ? "Rasmni almashtirish" : "Haqiqiy rasm yuklash"}</span>
                            </Button>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {currentImg ? "Haqiqiy rasm biriktirilgan" : "Rasm yuklanmagan"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const comboOptions = comboboxFields[key];
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground capitalize">
                        {label}
                      </Label>
                      {comboOptions ? (
                        <FieldCombobox
                          value={val}
                          onChange={(v) => setFormData(prev => ({ ...prev, [key]: v }))}
                          options={comboOptions}
                          placeholder={`Select ${label.toLowerCase()}...`}
                          searchPlaceholder={`Search ${label.toLowerCase()}...`}
                        />
                      ) : (
                        <Input
                          value={val}
                          onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                          className="h-9 text-sm bg-background border-input"
                          placeholder={`Enter ${label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── VIEW MODE ───────────────────────────────────── */}
          {sheetMode === 'view' && selectedRecord && (() => {
            const isPending = selectedRecord.status === 'Pending' || selectedRecord.status === 'In Transit' || selectedRecord.status === 'Inspecting' || selectedRecord.status === 'Received' || selectedRecord.status === 'Packed' || selectedRecord.status === 'Dispatched';
            const isLocked = selectedRecord.status === 'Completed' || selectedRecord.status === 'Accepted' || selectedRecord.status === 'Delivered';
            return (
              <>
                <div className="p-5 border-b border-border flex flex-col gap-3.5 pt-4 pr-12">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="text-base font-semibold truncate">
                        {selectedRecord.id} Details
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                        {isLocked ? 'This document is locked and cannot be edited.' : 'Review and confirm the record.'}
                      </SheetDescription>
                    </div>
                    <Badge
                      variant={isLocked ? 'default' : 'secondary'}
                      className={`shrink-0 font-medium px-2 py-0.5 whitespace-nowrap flex items-center gap-1 ${isLocked ? 'bg-green-600 hover:bg-green-600 text-white' : ''}`}
                    >
                      {isLocked && <Lock className="w-3 h-3" />}
                      <span>{selectedRecord.status}</span>
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 w-full">
                    {isPending && (
                      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setIsConfirmAlertOpen}>
                        <AlertDialogTrigger render={
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1 gap-1.5 shadow-none">
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </Button>
                        } />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Stock Document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              You are about to confirm {selectedRecord.id}. This action will lock the document and update the warehouse balance. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Yes, Confirm</span>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {selectedRecord.deliveryActId && selectedRecord.deliveryActId.startsWith("SF-") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const act = deliveryActs.find((a) => a.id === selectedRecord.deliveryActId);
                          setSelectedRecord(null);
                          openTab({
                            id: selectedRecord.deliveryActId,
                            title: `${selectedRecord.deliveryActId}: ${selectedRecord.customer}`,
                            type: "delivery-act",
                            module: "sales",
                            activeLevel3Tab: "overview",
                            documentData: act || {
                              id: selectedRecord.deliveryActId,
                              customer: selectedRecord.customer,
                              product: selectedRecord.product,
                              quantity: selectedRecord.quantity,
                              workOrderId: selectedRecord.workOrder,
                            },
                          });
                        }}
                        className="flex-1 gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>{selectedRecord.deliveryActId}</span>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className={`${isPending ? 'flex-1' : 'w-full'} gap-1.5`}>
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Document</span>
                    </Button>
                  </div>
                </div>

                <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                  {(type === 'stock-balance' || selectedRecord.imageUrl) && (() => {
                    const img = selectedRecord.imageUrl;
                    return (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                        <div
                          className="size-16 rounded-md border border-border bg-background overflow-hidden p-1 shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all shadow-sm"
                          onClick={() => {
                            if (img) {
                              setPreviewMaterial({
                                imageUrl: img,
                                title: selectedRecord.name || selectedRecord.sku || selectedRecord.id,
                                sku: selectedRecord.sku,
                                category: selectedRecord.category,
                                spec: selectedRecord.sheetFormat || selectedRecord.cutDimensions,
                                stock: selectedRecord.available !== undefined ? selectedRecord.available.toLocaleString() : selectedRecord.stockLevel,
                                unit: selectedRecord.unit,
                                location: selectedRecord.location,
                                supplier: selectedRecord.supplier,
                                status: selectedRecord.status,
                              });
                            } else {
                              setUploadTargetRecord(selectedRecord);
                              setIsUploadDialogOpen(true);
                            }
                          }}
                          title={img ? "Rasmni kattalashtirish uchun bosing" : "Haqiqiy rasm yuklash"}
                        >
                          {img ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={img} alt="Preview" className="size-full object-contain select-none" />
                          ) : (
                            <Camera className="size-6 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {selectedRecord.name || selectedRecord.sku || "Material"}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {img ? "Haqiqiy fotosurat yuklangan" : "Fotosurat yuklanmagan"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUploadTargetRecord(selectedRecord);
                              setIsUploadDialogOpen(true);
                            }}
                            className="h-7 text-xs gap-1.5 w-full justify-center"
                          >
                            <Camera className="size-3.5 text-muted-foreground" />
                            <span>{img ? "Rasmni almashtirish" : "Haqiqiy rasm yuklash"}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {Object.entries(selectedRecord).map(([key, val]) => {
                    if (key === 'id' || key === 'status' || key === 'imageUrl') return null;
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <Input
                          value={String(val)}
                          readOnly={isLocked}
                          className={`h-9 text-sm ${isLocked ? 'bg-muted/50 text-muted-foreground border-transparent shadow-none cursor-default' : 'bg-background border-input'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

        </SheetContent>
      </Sheet>

      <ReturnOffcutDialog open={isOffcutDialogOpen} onOpenChange={setIsOffcutDialogOpen} />
      <MaterialImageModal
        data={previewMaterial}
        isOpen={!!previewMaterial}
        onClose={() => setPreviewMaterial(null)}
      />
      <MaterialImageUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => {
          setIsUploadDialogOpen(false);
          setUploadTargetRecord(null);
        }}
        materialName={uploadTargetRecord?.name || formData?.name || "Yangi material"}
        materialSku={uploadTargetRecord?.sku || formData?.sku}
        currentImageUrl={
          uploadTargetRecord?.imageUrl ||
          formData?.imageUrl ||
          undefined
        }
        onSave={(newUrl) => {
          if (uploadTargetRecord) {
            if (type === "stock-balance") {
              upsertWarehouseStock({
                ...uploadTargetRecord,
                imageUrl: newUrl,
              });
            }
            setSelectedRecord((prev: any) => (prev ? { ...prev, imageUrl: newUrl } : null));
            setRowsData((prev) =>
              prev.map((r) =>
                (uploadTargetRecord.sku && r.sku === uploadTargetRecord.sku) ||
                (uploadTargetRecord.id && r.id === uploadTargetRecord.id)
                  ? { ...r, imageUrl: newUrl }
                  : r
              )
            );
          } else {
            setFormData((prev) => ({ ...prev, imageUrl: newUrl }));
          }
        }}
      />
    </ContextMenu>
  );
}
