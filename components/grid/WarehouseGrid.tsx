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
  ExternalLink,
  Check,
  Lock,
  FileText,
  Save,
  X,
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
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
  type: string; // "stock-balance" | "movements" | "inventory" | "receipts" | "shipments" | "locations"
}

export function WarehouseGrid({ type }: WarehouseGridProps) {
  const tCommon = useTranslations("Common");
  const { updateGridStats, theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [rowsData, setRowsData] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'view' | 'create'>('view');
  const [formData, setFormData] = useState<Record<string, string>>({});

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
      category: '',
      location: '',
      stockLevel: '',
      reserved: '0',
      available: '',
      unit: 'sheets',
      lastReceived: new Date().toISOString().split('T')[0],
      status: 'In Stock',
    },
  };

  const handleCreateNew = () => {
    const template = blankTemplates[type] ?? {};
    setFormData(template);
    setSelectedRecord(null);
    setSheetMode('create');
  };

  const handleSave = () => {
    const prefixes: Record<string, string> = {
      movements: 'MOV', receipts: 'RCV', shipments: 'SHP',
      inventory: 'IC', locations: 'LOC', 'stock-balance': 'STK',
    };
    const prefix = prefixes[type] ?? 'REC';
    const newId = `${prefix}-${String(Date.now()).slice(-5)}`;
    const newRow = { id: newId, ...formData };
    setRowsData(prev => [newRow, ...prev]);
    setSheetMode('view');
    setFormData({});
    setSelectedRecord(newRow);
  };

  const handleOpenSheet = (record: any) => {
    setSheetMode('view');
    setSelectedRecord(record);
  };


  const columns = useMemo(() => {
    let cols: GridColumn[] = [];
    if (type === 'stock-balance') {
      cols = [
        { id: 'sku', title: 'SKU', width: 100, icon: GridColumnIcon.HeaderReference },
        { id: 'name', title: 'Material Name', width: 300, icon: GridColumnIcon.HeaderString },
        { id: 'category', title: 'Category', width: 120, icon: GridColumnIcon.HeaderLookup },
        { id: 'location', title: 'Location', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'stockLevel', title: 'Total Stock', width: 110, icon: GridColumnIcon.HeaderNumber },
        { id: 'reserved', title: 'Reserved', width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: 'available', title: 'Available', width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: 'unit', title: 'Unit', width: 80, icon: GridColumnIcon.HeaderString },
        { id: 'lastReceived', title: 'Last Received', width: 120, icon: GridColumnIcon.HeaderDate },
        { id: 'status', title: 'Stock Status', width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
    } else if (type === 'movements') {
      cols = [
        { id: 'id', title: 'Move ID', width: 110, icon: GridColumnIcon.HeaderReference },
        { id: 'date', title: 'Date', width: 110, icon: GridColumnIcon.HeaderDate },
        { id: 'material', title: 'Material', width: 250, icon: GridColumnIcon.HeaderString },
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
        { id: 'date', title: 'Date', width: 110, icon: GridColumnIcon.HeaderDate },
        { id: 'customer', title: 'Customer', width: 200, icon: GridColumnIcon.HeaderString },
        { id: 'workOrder', title: 'Work Order', width: 120, icon: GridColumnIcon.HeaderReference },
        { id: 'product', title: 'Product', width: 240, icon: GridColumnIcon.HeaderString },
        { id: 'quantity', title: 'Qty', width: 90, icon: GridColumnIcon.HeaderNumber },
        { id: 'from', title: 'Ship From', width: 220, icon: GridColumnIcon.HeaderString },
        { id: 'carrier', title: 'Carrier', width: 160, icon: GridColumnIcon.HeaderString },
        { id: 'trackingNo', title: 'Tracking No', width: 140, icon: GridColumnIcon.HeaderString },
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
    let mockRows = [];
    if (type === 'stock-balance') mockRows = generateStockBalance();
    else if (type === 'movements') mockRows = generateMovements();
    else if (type === 'inventory') mockRows = generateInventoryCounts();
    else if (type === 'receipts') mockRows = generateReceipts();
    else if (type === 'shipments') mockRows = generateShipments();
    else mockRows = generateLocations();
    setRowsData(mockRows);
  }, [type]);

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
      return matchesSearch && matchesStatus;
    });
  }, [rowsData, searchFilter, statusFilter]);

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


  // Double-click on row / cell opens document sheet
  const handleCellActivated = useCallback((cell: Item) => {
    const [, row] = cell;
    const rowData = filteredRows[row];
    if (rowData) {
      handleOpenSheet(rowData);
    }
  }, [filteredRows]);

  const handleOpenSelected = useCallback(() => {
    let rowIndex = 0;
    if (selection.current?.cell) {
      rowIndex = selection.current.cell[1];
    } else if (selection.rows.length > 0) {
      rowIndex = selection.rows.toArray()[0];
    }
    const rowData = filteredRows[rowIndex];
    if (rowData) {
      handleOpenSheet(rowData);
    }
  }, [filteredRows, selection]);

  const handleConfirm = () => {
    if (!selectedRecord) return;
    
    setRowsData(prev => prev.map(r => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          status: 'Completed',
          receivedQty: r.quantity !== undefined ? r.quantity : r.receivedQty,
        };
      }
      return r;
    }));
    
    setSelectedRecord((prev: any) => prev ? { ...prev, status: 'Completed', receivedQty: prev.quantity !== undefined ? prev.quantity : prev.receivedQty } : null);
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

    // Status column — color-coded
    if (column.id === "status") {
      const positives = ["In Stock", "Completed", "Received", "Accepted", "Delivered", "Matched", "Active"];
      const negatives = ["Critical", "Out of Stock", "Shortage", "Quarantine", "Inactive"];
      const warnings = ["Low Stock", "In Transit", "Pending", "Inspecting", "Packed", "Dispatched", "Surplus"];

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
              <Button 
                onClick={handleOpenSelected}
                variant="outline" 
                size="sm" 
                className="h-7 px-2.5 text-xs font-medium gap-1 rounded"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                <span>Open</span>
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />

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
              freezeColumns={1}
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
            const isPending = selectedRecord.status === 'Pending' || selectedRecord.status === 'In Transit' || selectedRecord.status === 'Inspecting' || selectedRecord.status === 'Received';
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
                    <Button size="sm" variant="outline" className={`${isPending ? 'flex-1' : 'w-full'} gap-1.5`}>
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Document</span>
                    </Button>
                  </div>
                </div>

                <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                  {Object.entries(selectedRecord).map(([key, val]) => {
                    if (key === 'id' || key === 'status') return null;
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
    </ContextMenu>
  );
}
