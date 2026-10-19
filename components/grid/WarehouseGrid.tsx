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
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { ReturnOffcutDialog } from "./ReturnOffcutDialog";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { getMaterialImage } from "@/lib/materialImages";
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

// ─── Real-world printing warehouse data ──────────────────────────────────────

const LOCATIONS = ["Main Factory — Tashkent", "Branch Warehouse — Samarkand", "Finishing Shop — Bukhara"];

function generateStockBalance() {
  const items = [
    { sku: "PAP-001", name: "Galerie Art Silk 150g/m² (SRA3)", category: "Paper", unit: "sheets", reorder: 10000 },
    { sku: "PAP-002", name: "Munken Polar Rough 120g/m² (A4)", category: "Paper", unit: "sheets", reorder: 8000 },
    { sku: "PAP-003", name: "Kraft Board 350g/m² (700×1000)", category: "Board", unit: "sheets", reorder: 3000 },
    { sku: "PAP-004", name: "Chromolux Cast Coated 250g (B1)", category: "Paper", unit: "sheets", reorder: 5000 },
    { sku: "PAP-005", name: "Colorplan Ebony 270g/m² (SRA2)", category: "Specialty", unit: "sheets", reorder: 2000 },
    { sku: "INK-001", name: "Toyo Hyplus Cyan (Process)", category: "Ink", unit: "kg", reorder: 20 },
    { sku: "INK-002", name: "Toyo Hyplus Magenta (Process)", category: "Ink", unit: "kg", reorder: 20 },
    { sku: "INK-003", name: "Toyo Hyplus Yellow (Process)", category: "Ink", unit: "kg", reorder: 20 },
    { sku: "INK-004", name: "Toyo Hyplus Black (Process)", category: "Ink", unit: "kg", reorder: 30 },
    { sku: "INK-005", name: "Pantone 186 C (Spot Red)", category: "Ink", unit: "kg", reorder: 5 },
    { sku: "INK-006", name: "Pantone 877 C (Silver Metallic)", category: "Ink", unit: "kg", reorder: 3 },
    { sku: "CON-001", name: "Heidelberg Wash-Up Solution 5L", category: "Consumable", unit: "bottles", reorder: 10 },
    { sku: "CON-002", name: "Offset Dampening Additive IPA-Free", category: "Consumable", unit: "liters", reorder: 50 },
    { sku: "CON-003", name: "Rubber Blanket (Heidelberg XL 106)", category: "Consumable", unit: "pcs", reorder: 4 },
    { sku: "CON-004", name: "UV Varnish — Gloss (20L drum)", category: "Coating", unit: "drums", reorder: 3 },
    { sku: "CON-005", name: "Soft-Touch Matte Lamination Film 320mm", category: "Coating", unit: "rolls", reorder: 5 },
    { sku: "CON-006", name: "Hot Melt Glue PUR (Kolbus)", category: "Adhesive", unit: "kg", reorder: 25 },
    { sku: "CON-007", name: "Stitching Wire 0.55mm (Galvanized)", category: "Bindery", unit: "spools", reorder: 10 },
    { sku: "CON-008", name: "Shrink Wrap Film 450mm", category: "Packaging", unit: "rolls", reorder: 8 },
    { sku: "FIN-001", name: "Gold Foil — Hot Stamp 220mm", category: "Foil", unit: "rolls", reorder: 6 },
    { sku: "FIN-002", name: "Holographic Foil 160mm", category: "Foil", unit: "rolls", reorder: 3 },
    { sku: "FIN-003", name: "Die-Cut Matrix Board 2mm", category: "Tooling", unit: "sheets", reorder: 50 },
    { sku: "PLT-001", name: "CTP Plate Fuji Brillia 790×1030", category: "Plate", unit: "pcs", reorder: 100 },
    { sku: "PLT-002", name: "CTP Plate Developer Concentrate", category: "Plate", unit: "liters", reorder: 20 },
    { sku: "THR-001", name: "Polyester Thread (White) — Smyth Sewing", category: "Bindery", unit: "cones", reorder: 12 },
  ];

  return items.map((item, i) => {
    const stocks = LOCATIONS.map(() => Math.floor(Math.random() * item.reorder * 3));
    const totalStock = stocks.reduce((a, b) => a + b, 0);
    return {
      ...item,
      location: LOCATIONS[i % LOCATIONS.length],
      stockLevel: totalStock,
      reserved: Math.floor(totalStock * 0.3),
      available: totalStock - Math.floor(totalStock * 0.3),
      lastReceived: `2026-09-${String(15 + (i % 15)).padStart(2, "0")}`,
      status: totalStock > item.reorder * 1.5 ? "In Stock" : totalStock > item.reorder * 0.3 ? "Low Stock" : "Critical",
    };
  });
}

function generateMovements() {
  const reasons = [
    "Production order WO-00351 — Hardcover Catalog",
    "Restock from Samarkand branch",
    "Transfer for WO-00365 — Calendar print",
    "Urgent pull for WO-00370 — A4 Booklet rush",
    "Monthly rebalance between warehouses",
    "Return defective stock — supplier claim",
    "Quality hold release — ink batch verified",
    "Branch request — Bukhara finishing shop",
  ];
  const materials = [
    "Galerie Art Silk 150g (SRA3)", "Munken Polar 120g (A4)", "Toyo Cyan Ink",
    "Toyo Black Ink", "Hot Melt Glue PUR", "UV Varnish Gloss", "Gold Foil 220mm",
    "CTP Plate 790×1030", "Soft-Touch Lamination Film",
  ];
  return Array.from({ length: 120 }, (_, i) => {
    const status = ["Completed", "In Transit", "Pending"][i % 3];
    const quantity = [500, 1000, 25, 50, 10, 2, 3, 20, 4][i % 9];
    
    // If it's In Transit or Pending, nothing has been received yet (0).
    // If Completed, mostly full quantity is received, occasionally with a shortage/discrepancy (e.g. 95% received)
    let receivedQty = status === "Completed" ? quantity : 0;
    if (status === "Completed" && i % 8 === 0) {
      receivedQty = Math.floor(quantity * 0.9); // Discrepancy simulation
    }

    return {
      id: `MOV-${String(4000 + i).padStart(4, "0")}`,
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      material: materials[i % materials.length],
      quantity,
      receivedQty,
      unit: ["sheets", "sheets", "kg", "kg", "kg", "drums", "rolls", "pcs", "rolls"][i % 9],
      from: LOCATIONS[i % 3],
      to: LOCATIONS[(i + 1) % 3],
      reason: reasons[i % reasons.length],
      status,
      operator: ["D. Karimov", "S. Abdullayev", "N. Yusupova", "R. Ismoilov"][i % 4],
    };
  });
}

function generateInventoryCounts() {
  const materials = [
    "Galerie Art Silk 150g", "Kraft Board 350g", "Toyo Cyan", "Toyo Magenta",
    "Toyo Yellow", "Toyo Black", "UV Varnish Gloss", "Hot Melt Glue PUR",
    "CTP Plate Fuji", "Stitching Wire 0.55mm",
  ];
  return Array.from({ length: 60 }, (_, i) => {
    const systemQty = Math.floor(1000 + Math.random() * 5000);
    const variance = Math.floor((Math.random() - 0.5) * 200);
    const actualQty = systemQty + variance;
    return {
      id: `IC-${String(2026090 + i)}`,
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      location: LOCATIONS[i % 3],
      material: materials[i % materials.length],
      systemQty,
      actualQty,
      variance,
      unit: i < 5 ? "sheets" : ["kg", "drums", "pcs", "spools"][i % 4],
      status: Math.abs(variance) < 50 ? "Matched" : variance > 0 ? "Surplus" : "Shortage",
      countedBy: ["D. Karimov", "S. Abdullayev", "N. Yusupova"][i % 3],
    };
  });
}

function generateReceipts() {
  const suppliers = [
    "Antalis Central Asia", "Igepa Group GmbH", "Toyo Ink Uzbekistan",
    "Fujifilm CIS", "Kolbus Parts Europe", "KURZ Foils Asia",
  ];
  const materials = [
    { name: "Galerie Art Silk 150g/m² (SRA3)", qty: 10000, unit: "sheets" },
    { name: "Munken Polar 120g/m² (A4)", qty: 15000, unit: "sheets" },
    { name: "Kraft Board 350g (700×1000)", qty: 5000, unit: "sheets" },
    { name: "Toyo Hyplus Cyan (Process)", qty: 50, unit: "kg" },
    { name: "Toyo Hyplus Black (Process)", qty: 80, unit: "kg" },
    { name: "UV Varnish Gloss 20L drum", qty: 5, unit: "drums" },
    { name: "CTP Plate Fuji Brillia 790×1030", qty: 200, unit: "pcs" },
    { name: "Gold Foil Hot Stamp 220mm", qty: 10, unit: "rolls" },
    { name: "Hot Melt Glue PUR (Kolbus)", qty: 100, unit: "kg" },
    { name: "Soft-Touch Matte Film 320mm", qty: 8, unit: "rolls" },
  ];
  return Array.from({ length: 90 }, (_, i) => {
    const mat = materials[i % materials.length];
    return {
      id: `RCV-${String(3000 + i).padStart(4, "0")}`,
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      supplier: suppliers[i % suppliers.length],
      material: mat.name,
      quantity: mat.qty + Math.floor(Math.random() * mat.qty * 0.2),
      unit: mat.unit,
      location: LOCATIONS[i % 3],
      poNumber: `PO-2026-${String(800 + i).padStart(4, "0")}`,
      status: ["Received", "Inspecting", "Quarantine", "Accepted"][i % 4],
      receivedBy: ["D. Karimov", "S. Abdullayev", "N. Yusupova", "R. Ismoilov"][i % 4],
    };
  });
}

function generateShipments() {
  const customers = [
    "Alpha Media Group LLC", "Nordic Print Co", "Baltic Press LLC",
    "Apex Packaging", "Zenith Publishing", "Vanguard Fashion",
  ];
  const products = [
    { name: "A4 Hardcover Catalog 96p", qty: 5000, unit: "pcs" },
    { name: "A5 Wire-O Booklet 32p", qty: 3000, unit: "pcs" },
    { name: "Custom Folding Carton 350g", qty: 10000, unit: "pcs" },
    { name: "Offset Magazine Gloss 64p", qty: 8000, unit: "pcs" },
    { name: "Tri-fold Calendar 2027", qty: 2000, unit: "pcs" },
    { name: "Self-Adhesive Labels (Roll)", qty: 50000, unit: "pcs" },
  ];
  const carriers = ["Express Logistics UZ", "DHL Freight", "Own Vehicle", "Customer Pickup"];
  return Array.from({ length: 70 }, (_, i) => {
    const prod = products[i % products.length];
    return {
      id: `SHP-${String(6000 + i).padStart(4, "0")}`,
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      customer: customers[i % customers.length],
      workOrder: `WO-${String(350 + (i % 30)).padStart(5, "0")}`,
      product: prod.name,
      quantity: prod.qty,
      unit: prod.unit,
      from: LOCATIONS[i % 3],
      carrier: carriers[i % carriers.length],
      trackingNo: i % 4 === 3 ? "—" : `TRK${String(900000 + i * 7)}`,
      status: ["Packed", "Dispatched", "In Transit", "Delivered"][i % 4],
    };
  });
}

function generateLocations() {
  return [
    { id: "LOC-001", name: "Main Factory — Tashkent", type: "Factory", address: "12 Amir Temur St, Tashkent 100000", zones: 8, totalSKUs: 142, capacity: "85%", manager: "D. Karimov", status: "Active" },
    { id: "LOC-002", name: "Branch Warehouse — Samarkand", type: "Warehouse", address: "45 Registan Ave, Samarkand 140100", zones: 4, totalSKUs: 67, capacity: "62%", manager: "S. Abdullayev", status: "Active" },
    { id: "LOC-003", name: "Finishing Shop — Bukhara", type: "Workshop", address: "8 Ismoil Somoni St, Bukhara 200100", zones: 3, totalSKUs: 38, capacity: "71%", manager: "N. Yusupova", status: "Active" },
    { id: "LOC-004", name: "Outdoor Paper Storage", type: "Storage", address: "Main Factory Yard, Building C", zones: 2, totalSKUs: 18, capacity: "90%", manager: "R. Ismoilov", status: "Active" },
    { id: "LOC-005", name: "Ink & Chemical Store", type: "Hazmat", address: "Main Factory, Block D (Climate Controlled)", zones: 1, totalSKUs: 24, capacity: "55%", manager: "D. Karimov", status: "Active" },
    { id: "LOC-006", name: "Finished Goods — Dispatch Bay", type: "Staging", address: "Main Factory, Gate 2", zones: 2, totalSKUs: 31, capacity: "78%", manager: "R. Ismoilov", status: "Active" },
    { id: "LOC-007", name: "Archive Warehouse (Cold)", type: "Archive", address: "Industrial Zone, Lot 14", zones: 1, totalSKUs: 5, capacity: "22%", manager: "S. Abdullayev", status: "Inactive" },
  ];
}

// ─── Combobox option datasets ─────────────────────────────────────────────────

const MATERIALS_OPTIONS: ComboboxOption[] = [
  { value: "Galerie Art Silk 150g/m² (SRA3)", label: "Galerie Art Silk 150g/m² (SRA3)" },
  { value: "Munken Polar Rough 120g/m² (A4)", label: "Munken Polar Rough 120g/m² (A4)" },
  { value: "Kraft Board 350g/m² (700×1000)", label: "Kraft Board 350g/m² (700×1000)" },
  { value: "Chromolux Cast Coated 250g (B1)", label: "Chromolux Cast Coated 250g (B1)" },
  { value: "Colorplan Ebony 270g/m² (SRA2)", label: "Colorplan Ebony 270g/m² (SRA2)" },
  { value: "Toyo Hyplus Cyan (Process)", label: "Toyo Hyplus Cyan (Process)" },
  { value: "Toyo Hyplus Magenta (Process)", label: "Toyo Hyplus Magenta (Process)" },
  { value: "Toyo Hyplus Yellow (Process)", label: "Toyo Hyplus Yellow (Process)" },
  { value: "Toyo Hyplus Black (Process)", label: "Toyo Hyplus Black (Process)" },
  { value: "Pantone 186 C (Spot Red)", label: "Pantone 186 C (Spot Red)" },
  { value: "Pantone 877 C (Silver Metallic)", label: "Pantone 877 C (Silver Metallic)" },
  { value: "UV Varnish — Gloss (20L drum)", label: "UV Varnish — Gloss (20L drum)" },
  { value: "Soft-Touch Matte Lamination Film 320mm", label: "Soft-Touch Matte Lamination Film 320mm" },
  { value: "Hot Melt Glue PUR (Kolbus)", label: "Hot Melt Glue PUR (Kolbus)" },
  { value: "Stitching Wire 0.55mm (Galvanized)", label: "Stitching Wire 0.55mm (Galvanized)" },
  { value: "CTP Plate Fuji Brillia 790×1030", label: "CTP Plate Fuji Brillia 790×1030" },
  { value: "Gold Foil — Hot Stamp 220mm", label: "Gold Foil — Hot Stamp 220mm" },
  { value: "Holographic Foil 160mm", label: "Holographic Foil 160mm" },
  { value: "Rubber Blanket (Heidelberg XL 106)", label: "Rubber Blanket (Heidelberg XL 106)" },
  { value: "Shrink Wrap Film 450mm", label: "Shrink Wrap Film 450mm" },
];

const LOCATIONS_OPTIONS: ComboboxOption[] = LOCATIONS.map((l) => ({ value: l, label: l }));

const SUPPLIERS_OPTIONS: ComboboxOption[] = [
  { value: "Antalis Central Asia", label: "Antalis Central Asia" },
  { value: "Igepa Group GmbH", label: "Igepa Group GmbH" },
  { value: "Toyo Ink Uzbekistan", label: "Toyo Ink Uzbekistan" },
  { value: "Fujifilm CIS", label: "Fujifilm CIS" },
  { value: "Kolbus Parts Europe", label: "Kolbus Parts Europe" },
  { value: "KURZ Foils Asia", label: "KURZ Foils Asia" },
  { value: "Heidelberg CIS", label: "Heidelberg CIS" },
  { value: "BASF Printing Chemicals", label: "BASF Printing Chemicals" },
];

const CUSTOMERS_OPTIONS: ComboboxOption[] = [
  { value: "Alpha Media Group LLC", label: "Alpha Media Group LLC" },
  { value: "Nordic Print Co", label: "Nordic Print Co" },
  { value: "Baltic Press LLC", label: "Baltic Press LLC" },
  { value: "Apex Packaging", label: "Apex Packaging" },
  { value: "Zenith Publishing", label: "Zenith Publishing" },
  { value: "Vanguard Fashion", label: "Vanguard Fashion" },
  { value: "Central Asia Retail Group", label: "Central Asia Retail Group" },
  { value: "Silk Road Books", label: "Silk Road Books" },
];

const UNITS_OPTIONS: ComboboxOption[] = [
  { value: "sheets", label: "sheets" },
  { value: "kg", label: "kg" },
  { value: "pcs", label: "pcs" },
  { value: "rolls", label: "rolls" },
  { value: "drums", label: "drums" },
  { value: "liters", label: "liters" },
  { value: "bottles", label: "bottles" },
  { value: "spools", label: "spools" },
  { value: "cones", label: "cones" },
];

const OPERATORS_OPTIONS: ComboboxOption[] = [
  { value: "D. Karimov", label: "D. Karimov" },
  { value: "S. Abdullayev", label: "S. Abdullayev" },
  { value: "N. Yusupova", label: "N. Yusupova" },
  { value: "R. Ismoilov", label: "R. Ismoilov" },
];

const CARRIERS_OPTIONS: ComboboxOption[] = [
  { value: "Express Logistics UZ", label: "Express Logistics UZ" },
  { value: "DHL Freight", label: "DHL Freight" },
  { value: "Own Vehicle", label: "Own Vehicle" },
  { value: "Customer Pickup", label: "Customer Pickup" },
];

// Which fields render as combobox (key → options list)
const COMBOBOX_FIELDS: Record<string, ComboboxOption[]> = {
  material:    MATERIALS_OPTIONS,
  from:        LOCATIONS_OPTIONS,
  to:          LOCATIONS_OPTIONS,
  location:    LOCATIONS_OPTIONS,
  supplier:    SUPPLIERS_OPTIONS,
  customer:    CUSTOMERS_OPTIONS,
  carrier:     CARRIERS_OPTIONS,
  unit:        UNITS_OPTIONS,
  operator:    OPERATORS_OPTIONS,
  receivedBy:  OPERATORS_OPTIONS,
  countedBy:   OPERATORS_OPTIONS,
};

// ─── Component ───────────────────────────────────────────────────────────────

interface WarehouseGridProps {
  type: string; // "stock-balance" | "movements" | "inventory" | "receipts" | "shipments" | "locations" | "finished-goods"
}

export function WarehouseGrid({ type }: WarehouseGridProps) {
  const tCommon = useTranslations("Common");
  const {
    updateGridStats,
    theme,
    warehouseShipments,
    warehouseStock,
    warehouseMovements,
    finishedGoods,
    crmCustomers,
    upsertWarehouseStock,
    addWarehouseShipment,
    updateWarehouseShipmentStatus,
    deliveryActs,
    openTab,
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
      const newId = `RCV-${String(Date.now()).slice(-4)}`;
      openTab({
        id: newId,
        title: `${newId}: Yangi Kirim Hujjati`,
        type: "warehouse-receipt",
        module: "warehouse",
        isUnsaved: true,
        documentData: {
          id: newId,
          date: new Date().toISOString().split("T")[0],
          supplier: "Tashkent Paper Trade LLC",
          status: "Draft",
        },
      });
      return;
    }
    if (type === "shipments") {
      const nextNum = 6010 + warehouseShipments.length;
      const newId = `SHP-${nextNum}`;
      openTab({
        id: newId,
        title: `${newId}: Yangi Ombor Chiqimi`,
        type: "warehouse-shipment",
        module: "warehouse",
        isUnsaved: true,
        documentData: {
          id: newId,
          date: new Date().toISOString().split("T")[0],
          status: "Draft",
        },
      });
      return;
    }
    if (type === "finished-goods") {
      const nextNum = 6010 + warehouseShipments.length;
      const newId = `SHP-${nextNum}`;
      openTab({
        id: newId,
        title: `${newId}: Zaxiradan Chiqim`,
        type: "warehouse-shipment",
        module: "warehouse",
        isUnsaved: true,
        documentData: {
          id: newId,
          date: new Date().toISOString().split("T")[0],
          status: "Draft",
          notes: "Tayyor mahsulot (mijoz zaxirasi) omboridan chiqim",
        },
      });
      return;
    }
    const template = blankTemplates[type] ?? {};
    setFormData(template);
    setSelectedRecord(null);
    setSheetMode('create');
  };

  const handleSave = () => {
    const prefixes: Record<string, string> = {
      movements: 'MOV', receipts: 'RCV', shipments: 'SHP',
      inventory: 'IC', locations: 'LOC', 'stock-balance': 'MAT',
    };
    const prefix = prefixes[type] ?? 'REC';
    const newId = `${prefix}-${String(Date.now()).slice(-4)}`;
    const newRow = { id: newId, ...formData };
    if (type === 'shipments') {
      addWarehouseShipment({
        id: newId,
        date: formData.date || new Date().toISOString().split('T')[0],
        customer: formData.customer || 'Alpha Media Group LLC',
        deliveryActId: formData.deliveryActId || '—',
        workOrder: formData.workOrder || '—',
        product: formData.product || 'Printed Goods',
        quantity: Number(formData.quantity) || 1000,
        unit: formData.unit || 'pcs',
        from: formData.from || 'Main Factory — Tashkent',
        carrier: formData.carrier || 'Own Vehicle',
        trackingNo: formData.trackingNo || '—',
        status: 'Packed',
      });
    } else if (type === 'stock-balance') {
      const stockNum = Number(formData.stockLevel) || 5000;
      const resNum = Number(formData.reserved) || 0;
      upsertWarehouseStock({
        sku: formData.sku || newId,
        name: formData.name || 'New Printing Substrate',
        category: (formData.category as any) || 'Paper & Board',
        unit: (formData.unit as any) || 'sheets',
        location: formData.location || 'Rack A-01 (Main Paper Hall)',
        stockLevel: stockNum,
        reserved: resNum,
        available: Math.max(0, stockNum - resNum),
        reorder: 2000,
        unitPriceUsd: 0.25,
        lastReceived: formData.lastReceived || new Date().toISOString().split('T')[0],
        status: 'In Stock',
        imageUrl: formData.imageUrl || getMaterialImage({ name: formData.name, sku: formData.sku, category: formData.category }),
      });
    } else if (type === 'receipts') {
      setRowsData(prev => [newRow, ...prev]);
      const rcvQty = Number(formData.quantity) || 0;
      const matName = (formData.material || '').toLowerCase();
      const existingStock = warehouseStock.find(
        (s) => s.name.toLowerCase().includes(matName) || matName.includes(s.name.toLowerCase())
      );
      if (existingStock && rcvQty > 0) {
        upsertWarehouseStock({
          ...existingStock,
          stockLevel: existingStock.stockLevel + rcvQty,
          lastReceived: formData.date || new Date().toISOString().split('T')[0],
        });
      }
    } else {
      setRowsData(prev => [newRow, ...prev]);
    }
    setSheetMode('view');
    setFormData({});
    setSelectedRecord(newRow);
  };

  const handleOpenSheet = (record: any) => {
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

  useEffect(() => {
    if (type === 'finished-goods') {
      setRowsData(finishedGoods);
      return;
    }
    if (type === 'shipments') {
      setRowsData(warehouseShipments);
      return;
    }
    if (type === 'stock-balance') {
      setRowsData(warehouseStock);
      return;
    }
    if (type === 'movements') {
      setRowsData(warehouseMovements);
      return;
    }
    let mockRows = [];
    if (type === 'inventory') mockRows = generateInventoryCounts();
    else if (type === 'receipts') mockRows = generateReceipts();
    else mockRows = generateLocations();
    setRowsData(mockRows);
  }, [type, warehouseShipments, warehouseStock, warehouseMovements, finishedGoods]);

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
        setPreviewMaterial({
          imageUrl: rowData.imageUrl || getMaterialImage(rowData),
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
      const img = rowData.imageUrl || getMaterialImage(rowData);
      return {
        kind: GridCellKind.Image,
        data: [img],
        displayData: [img],
        allowOverlay: true,
      };
    }

    // Status column — color-coded
    if (column.id === "status") {
      const positives = ["In Stock", "Completed", "Received", "Accepted", "Delivered", "Matched", "Active", "Ready for Dispatch", "Partially Shipped"];
      const negatives = ["Critical", "Out of Stock", "Shortage", "Quarantine", "Inactive"];
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
              <Button 
                size="sm" 
                onClick={handleCreateNew}
                className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New</span>
              </Button>

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

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Finished Goods KPI Summary Strip */}
              {type === 'finished-goods' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-muted/80 px-2.5 py-0.5 rounded text-[11px] gap-2 border border-border">
                    <span className="text-muted-foreground">📦 Mas&apos;ul Saqlovdagi Zaxira:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {finishedGoods.reduce((sum, g) => sum + g.stockQty, 0).toLocaleString()} dona
                    </span>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="text-muted-foreground">Mijozlar:</span>
                    <span className="font-semibold text-foreground">
                      {new Set(finishedGoods.map((g) => g.customerName)).size} ta
                    </span>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="text-muted-foreground">Umumiy Qiymati:</span>
                    <span className="font-mono font-semibold text-foreground">
                      ${finishedGoods.reduce((sum, g) => sum + g.totalStockValue, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

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

              {availableStatuses.length > 0 && (
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
                    const currentImg = val || getMaterialImage({ name: formData.name, sku: formData.sku, category: formData.category });
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Material Rasmi (Image)
                        </Label>
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                          <div className="size-14 rounded-md border border-border bg-background overflow-hidden p-1 shrink-0 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentImg} alt="Preview" className="size-full object-contain" />
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
                              <span>Rasm yuklash / tanlash</span>
                            </Button>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {val ? "Maxsus rasm biriktirilgan" : "Avtomatik vektor shablon"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const comboOptions = COMBOBOX_FIELDS[key];
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
                  {(type === 'stock-balance' || selectedRecord.imageUrl || selectedRecord.category) && (() => {
                    const img = selectedRecord.imageUrl || getMaterialImage(selectedRecord);
                    return (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                        <div
                          className="size-16 rounded-md border border-border bg-background overflow-hidden p-1 shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all shadow-sm"
                          onClick={() => {
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
                          }}
                          title="Rasmni kattalashtirish uchun bosing"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="Preview" className="size-full object-contain select-none" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {selectedRecord.name || selectedRecord.sku || "Material"}
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
                            <span>Rasmni o'zgartirish</span>
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
          (uploadTargetRecord ? getMaterialImage(uploadTargetRecord) : undefined)
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
