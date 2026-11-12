"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
import {
  useWorkspaceStore,
  DocumentTab,
  WarehouseShipmentRecord,
  ShipmentLineItem,
  ScannedBoxEntry,
  ShipmentType,
  ProductionQueueItem,
  CrmCustomerRecord,
  WarehouseStockRecord,
} from "@/store/workspaceStore";
import { toast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { PickFinishedGoodsDialog } from "@/components/documents/warehouse/dialogs/PickFinishedGoodsDialog";
import { PickTradingCatalogDialog } from "@/components/documents/warehouse/dialogs/PickTradingCatalogDialog";
import { DispatchManifestDialog } from "@/components/documents/warehouse/dialogs/DispatchManifestDialog";
import { PackageCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { WarehouseSelect, type WarehouseSelectValue } from "@/components/common/WarehouseSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Truck,
  Plus,
  Trash2,
  Printer,
  Save,
  Check,
  Lock,
  ExternalLink,
  FileText,
  Boxes,
  Send,
  Layers,
  Search,
  ChevronsUpDown,
  SlidersHorizontal,
  Pencil,
  Phone,
  Scale,
  Package,
  Link2,
  RotateCcw,
  User,
  ShoppingBag,
  QrCode,
  AlertTriangle,
  X,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export const WAREHOUSE_LOCATIONS = [
  "Main Factory — Tashkent (Tayyor mahsulot ombori)",
  "Branch Warehouse — Samarkand (Taqsimot ombori)",
  "Finishing Shop — Bukhara (Bosma sexi)",
];

export interface CarrierProfile {
  id: string;
  name: string;
  vehicleModel: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  type: "fleet" | "courier" | "self" | "other";
}

export const DEFAULT_CARRIERS: CarrierProfile[] = [
  {
    id: "carrier-1",
    name: "PrintGoo Fleet #1 (ISUZU)",
    vehicleModel: "ISUZU Furgon 3.5t",
    vehicleNo: "01 A 772 BB",
    driverName: "Rustam Ismoilov",
    driverPhone: "+998 90 123-45-67",
    type: "fleet",
  },
  {
    id: "carrier-2",
    name: "PrintGoo Fleet #2 (Labo)",
    vehicleModel: "Labo 0.7t (Furgon)",
    vehicleNo: "01 B 334 CC",
    driverName: "Anvar Xalilov",
    driverPhone: "+998 90 987-65-43",
    type: "fleet",
  },
  {
    id: "carrier-3",
    name: "PrintGoo Fleet #3 (Gazelle)",
    vehicleModel: "Gazelle Next 1.5t",
    vehicleNo: "01 F 550 AA",
    driverName: "Jamshid Saidov",
    driverPhone: "+998 93 456-78-90",
    type: "fleet",
  },
  {
    id: "carrier-4",
    name: "Express Logistics UZ",
    vehicleModel: "Ford Transit Express",
    vehicleNo: "01 E 100 EX",
    driverName: "Navbatchi kuryer",
    driverPhone: "+998 71 200-11-22",
    type: "courier",
  },
  {
    id: "carrier-5",
    name: "BTS Express Pochta",
    vehicleModel: "BTS Logistics Van",
    vehicleNo: "01 B 707 TS",
    driverName: "BTS Kuryer",
    driverPhone: "+998 71 123-00-00",
    type: "courier",
  },
  {
    id: "carrier-6",
    name: "Yandex Delivery Cargo",
    vehicleModel: "Yandex Cargo Furgon",
    vehicleNo: "Ilovada belgilanadi",
    driverName: "Ilovadagi haydovchi",
    driverPhone: "+998 71 200-00-00",
    type: "courier",
  },
  {
    id: "carrier-7",
    name: "Mijoz o'zi olib ketadi (Samovyvoz)",
    vehicleModel: "Mijoz transporti",
    vehicleNo: "—",
    driverName: "Mijoz vakili",
    driverPhone: "—",
    type: "self",
  },
];

const BRANCH_RECIPIENTS = [
  "Samarkand Branch (Filial ombori)",
  "Bukhara Finishing Shop (Buxoro filiali)",
  "Andijan Distribution Center (Andijon filiali)",
];

const SUBCONTRACTORS = [
  "Master UV & Foil Co (Subpudrat)",
  "Gold Bookbinders Workshop (Muqovalash sexi)",
  "Spiral & Wire-O Masters",
  "Silk Screen Embellishers",
];

const VENDORS = [
  "Antalis Central Asia (Yetkazib beruvchi)",
  "Toyo Ink Uzbekistan",
  "Igepa Group GmbH",
  "Fujifilm CIS",
];

// ─── Searchable Shipment Type Combobox ──────────────────────────────────
export const SHIPMENT_TYPE_OPTIONS: { value: ShipmentType; label: string }[] = [
  { value: "CustomerDelivery", label: "Mijozga topshirish" },
  { value: "BranchTransfer", label: "Filialga jo'natish" },
  { value: "Outsourcing", label: "Subpudratga berish" },
  { value: "VendorReturn", label: "Yetkazib beruvchiga qaytarish" },
  { value: "MaterialSale", label: "Xomashyo sotuvi" },
];

function ShipmentTypeCombobox({
  value,
  onChange,
  disabled = false,
}: {
  value: ShipmentType;
  onChange: (val: ShipmentType) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = SHIPMENT_TYPE_OPTIONS.find((o) => o.value === value) || SHIPMENT_TYPE_OPTIONS[0];

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-7 w-full justify-between px-2 text-xs font-normal bg-background border-input shadow-none truncate"
          >
            <span className="truncate font-medium text-foreground">{current.label}</span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[240px] p-0 border border-border shadow-md" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Chiquv turini qidirish..." className="h-7 text-xs" />
          <CommandList className="max-h-52 p-1">
            <CommandEmpty className="p-2 text-xs text-muted-foreground text-center">
              Topilmadi
            </CommandEmpty>
            <CommandGroup>
              {SHIPMENT_TYPE_OPTIONS.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.value} ${opt.label}`}
                  data-checked={opt.value === value}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs py-1.5 px-2"
                >
                  <span className="font-medium text-foreground truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Work Order Picker (Customer-dependent) ────────────────────
function WorkOrderPicker({
  value,
  onSelect,
  orders,
  customer,
  disabled = false,
}: {
  value: string;
  onSelect: (woId: string) => void;
  orders: ProductionQueueItem[];
  customer?: string;
  onClearCustomer?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedWo = orders.find((o) => o.id === value);

  const sortedOrders = useMemo(() => {
    if (!customer || !customer.trim() || customer.startsWith("—")) {
      return orders;
    }
    const target = customer.trim().toLowerCase();
    const matching: ProductionQueueItem[] = [];
    const others: ProductionQueueItem[] = [];
    for (const o of orders) {
      if (o.customer && o.customer.trim().toLowerCase() === target) {
        matching.push(o);
      } else {
        others.push(o);
      }
    }
    return [...matching, ...others];
  }, [orders, customer]);

  const displayLabel = useMemo(() => {
    if (selectedWo) {
      return `${selectedWo.id} — ${selectedWo.product}`;
    }
    if (value && value !== "-" && !value.startsWith("—")) {
      return value;
    }
    if (value && value.startsWith("—")) {
      return "Buyurtmasiz chiqim";
    }
    return "Buyurtmani tanlang...";
  }, [selectedWo, value]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-7 w-full justify-between px-2 text-xs font-normal bg-background border-input shadow-none truncate"
          >
            <span className="truncate min-w-0 text-left font-medium">
              {selectedWo ? (
                <>
                  <span className="font-mono font-bold text-primary mr-1.5">{selectedWo.id}</span>
                  <span className="text-muted-foreground truncate">{selectedWo.product}</span>
                </>
              ) : (
                <span className={cn(value ? "text-foreground" : "text-muted-foreground")}>
                  {displayLabel}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[360px] p-0 border border-border shadow-md" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Buyurtma №, mahsulot yoki mijoz..." className="h-7 text-xs" />
          <CommandList className="max-h-60 p-1">
            <CommandEmpty className="p-2.5 text-xs text-muted-foreground text-center">
              Buyurtma topilmadi
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="DIRECT_SHIPMENT To'g'ridan-to'g'ri chiqim buyurtmasiz"
                data-checked={Boolean(value && value.startsWith("—"))}
                onSelect={() => {
                  onSelect("— (To'g'ridan-to'g'ri chiqim)");
                  setOpen(false);
                }}
                className="cursor-pointer text-xs py-1.5 px-2 text-muted-foreground font-medium"
              >
                <span>— Buyurtmasiz (To&apos;g&apos;ridan-to&apos;g&apos;ri chiqim)</span>
              </CommandItem>
              {sortedOrders.map((wo) => (
                <CommandItem
                  key={wo.id}
                  value={`${wo.id} ${wo.product} ${wo.customer || ""}`}
                  data-checked={wo.id === value}
                  onSelect={() => {
                    onSelect(wo.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs py-1.5 px-2 flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0 truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-bold text-primary shrink-0">{wo.id}</span>
                      <span className="truncate font-medium text-foreground">{wo.product}</span>
                    </div>
                    {wo.customer && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {wo.customer}
                      </span>
                    )}
                  </div>
                  {wo.quantity ? (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {wo.quantity.toLocaleString()} {wo.unit || "dona"}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Stock Material Dialog (Modal) ──────────────────────────────
function StockMaterialDialog({
  open,
  onOpenChange,
  stock,
  onSelectMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock: WarehouseStockRecord[];
  onSelectMaterial: (sku: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-3.5 bg-muted/40 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="size-4 text-blue-600" />
            <span>Ombordan xomashyo yoki material tanlash</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Mavjud qog'oz, bo'yoq, plyonka yoki delovoy otxod qoldiqlaridan qatorga qo'shish (Shift+F4)
          </DialogDescription>
        </DialogHeader>
        <Command className="w-full">
          <CommandInput placeholder="Material nomi yoki SKU bo'yicha qidirish..." className="h-9 text-xs" />
          <CommandList className="max-h-72 overflow-y-auto p-1.5">
            <CommandEmpty className="p-4 text-xs text-muted-foreground text-center">
              Mos keluvchi material topilmadi
            </CommandEmpty>
            <CommandGroup heading="Ombordagi qoldiqlar">
              {stock.map((item, idx) => (
                <CommandItem
                  key={`${item.id || item.sku}-${item.location || ""}-${idx}`}
                  value={`${item.sku} ${item.name} ${item.category} ${item.sheetFormat || ""} ${item.id || idx}`}
                  onSelect={() => {
                    onSelectMaterial(item.sku);
                    onOpenChange(false);
                  }}
                  className="flex items-center justify-between p-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted font-bold text-foreground shrink-0">
                        {item.sku}
                      </span>
                      <span className="font-medium truncate text-foreground text-xs">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Joyi: {item.location} {item.sheetFormat ? `• ${item.sheetFormat}` : ""}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] font-mono font-semibold ${
                      item.available > 0
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-red-500/15 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {item.available.toLocaleString()} {item.unit}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// ─── Searchable Recipient Combobox ─────────────────────────────────────────
function RecipientCombobox({
  value,
  onChange,
  shipmentType,
  customers,
  branches,
  subcontractors,
  vendors,
  disabled = false,
  isAutoLinked = false,
}: {
  value: string;
  onChange: (val: string) => void;
  shipmentType: ShipmentType;
  customers: CrmCustomerRecord[];
  branches: string[];
  subcontractors: string[];
  vendors: string[];
  disabled?: boolean;
  isAutoLinked?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (shipmentType === "BranchTransfer") {
      return branches.map((b) => ({ id: b, name: b, hint: "Filial" }));
    }
    if (shipmentType === "Outsourcing") {
      return subcontractors.map((s) => ({ id: s, name: s, hint: "Subpudrat" }));
    }
    if (shipmentType === "VendorReturn") {
      return vendors.map((v) => ({ id: v, name: v, hint: "Ta'minotchi" }));
    }
    return customers.map((c) => ({
      id: c.name,
      name: c.name,
      hint: c.tin ? `STIR: ${c.tin}` : c.industry,
    }));
  }, [shipmentType, branches, subcontractors, vendors, customers]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-7 w-full justify-between px-2 text-xs font-normal bg-background border-input shadow-none truncate"
          >
            <span className="truncate min-w-0 text-left font-medium text-foreground">
              {value || "Qabul qiluvchini tanlang..."}
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-0 border border-border shadow-md" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Qabul qiluvchini qidirish..." className="h-7 text-xs" />
          <CommandList className="max-h-60 p-1">
            <CommandEmpty className="p-2.5 text-xs text-muted-foreground text-center">
              Topilmadi
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.hint || ""}`}
                  data-checked={opt.name === value}
                  onSelect={() => {
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs py-1.5 px-2 flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-foreground truncate">{opt.name}</span>
                  {opt.hint && (
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {opt.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Warehouse Combobox ─────────────────────────────────────────
function WarehouseCombobox({
  value,
  onChange,
  warehouses,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  warehouses: { id: string; name: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-7 text-xs font-normal bg-background px-2.5 justify-between border-input shadow-none",
              className || "w-full"
            )}
          >
            <span className="truncate font-medium text-foreground">{value || "Omborni tanlang..."}</span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[300px] p-0 border border-border shadow-md" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Omborni qidirish..." className="h-7 text-xs" />
          <CommandList className="max-h-56 p-1">
            <CommandEmpty className="p-2 text-xs text-muted-foreground text-center">
              Ombor topilmadi
            </CommandEmpty>
            <CommandGroup>
              {warehouses.map((wh) => (
                <CommandItem
                  key={wh.id}
                  value={wh.name}
                  data-checked={wh.name === value}
                  onSelect={() => {
                    onChange(wh.name);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs py-1.5 px-2"
                >
                  <span className="font-medium text-foreground truncate">{wh.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Searchable Carrier Combobox (Bitta joyda chaqirish) ───────────────────
export function CarrierCombobox({
  carrier,
  vehicleNo,
  driverName,
  driverPhone,
  carriers,
  onSelect,
  onAddNew,
  onOpenCatalog,
  disabled = false,
  className,
}: {
  carrier: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  carriers: CarrierProfile[];
  onSelect: (profile: CarrierProfile) => void;
  onAddNew?: () => void;
  onOpenCatalog?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Match profile
  const selectedProfile = useMemo(() => {
    return carriers.find((c) => c.name === carrier || (c.vehicleNo && c.vehicleNo === vehicleNo));
  }, [carriers, carrier, vehicleNo]);

  const displayLabel = useMemo(() => {
    if (selectedProfile) {
      if (selectedProfile.vehicleNo && selectedProfile.vehicleNo !== "—") {
        return `${selectedProfile.name} • ${selectedProfile.vehicleNo}`;
      }
      return selectedProfile.name;
    }
    if (carrier) {
      if (vehicleNo && vehicleNo !== "—") return `${carrier} • ${vehicleNo}`;
      return carrier;
    }
    return "Tashuvchini tanlang...";
  }, [selectedProfile, carrier, vehicleNo]);

  return (
    <Popover open={open && !disabled} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-7 text-xs font-normal bg-background px-2.5 gap-1.5 justify-between border-input shadow-none truncate",
              className || "w-full"
            )}
          >
            <span className="truncate flex items-center gap-1.5 min-w-0">
              <Truck className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">{displayLabel}</span>
            </span>
            <ChevronsUpDown className="size-3.5 opacity-50 shrink-0 ml-1" />
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-0 border border-border shadow-md" align="start">
        <Command className="w-full">
          <CommandInput placeholder="Tashuvchi, haydovchi yoki raqam..." className="h-7 text-xs" />
          <CommandList className="max-h-60 p-1">
            <CommandEmpty className="p-2.5 text-xs text-muted-foreground text-center">
              Tashuvchi topilmadi
            </CommandEmpty>
            <CommandGroup>
              {carriers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.vehicleModel} ${c.vehicleNo} ${c.driverName || ""} ${c.driverPhone || ""}`}
                  data-checked={c.name === carrier || (Boolean(c.vehicleNo && c.vehicleNo === vehicleNo))}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs py-1.5 px-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    {c.type === "fleet" ? (
                      <Truck className="size-3.5 text-muted-foreground shrink-0" />
                    ) : c.type === "courier" ? (
                      <Package className="size-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ShoppingBag className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0 truncate">
                      <span className="font-medium text-foreground truncate">{c.name}</span>
                      {(c.driverName || c.vehicleModel) && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {[c.vehicleModel, c.driverName, c.driverPhone].filter((x) => x && x !== "—").join(" • ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.vehicleNo && c.vehicleNo !== "—" && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-foreground shrink-0">
                      {c.vehicleNo}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {(onAddNew || onOpenCatalog) && (
              <div className="p-1 border-t border-border mt-1 flex flex-col gap-0.5">
                {onAddNew && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                    className="w-full justify-start text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 h-7 gap-1.5 cursor-pointer rounded px-2"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    <span>Yangi tashuvchi qo&apos;shish</span>
                  </Button>
                )}
                {onOpenCatalog && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onOpenCatalog();
                    }}
                    className="w-full justify-start text-xs font-medium text-muted-foreground hover:text-foreground h-7 gap-1.5 cursor-pointer rounded px-2"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span>Transportlar ro&apos;yxati (Spravochnik)</span>
                  </Button>
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Carrier Dialog (Bitta joyda kiritish / tahrirlash) ──────────────────────
export function CarrierDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<CarrierProfile>;
  onSave: (profile: CarrierProfile) => void;
}) {
  const [name, setName] = useState(initialData?.name || "PrintGoo Fleet");
  const [type, setType] = useState<"fleet" | "courier" | "self" | "other">(initialData?.type || "fleet");
  const [vehicleModel, setVehicleModel] = useState(initialData?.vehicleModel || "");
  const [vehicleNo, setVehicleNo] = useState(initialData?.vehicleNo || "");
  const [driverName, setDriverName] = useState(initialData?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(initialData?.driverPhone || "");

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "PrintGoo Fleet");
      setType(initialData.type || "fleet");
      setVehicleModel(initialData.vehicleModel || "");
      setVehicleNo(initialData.vehicleNo || "");
      setDriverName(initialData.driverName || "");
      setDriverPhone(initialData.driverPhone || "");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: CarrierProfile = {
      id: initialData?.id || `carrier-${Date.now()}`,
      name: name || "Kompaniya transporti",
      type,
      vehicleModel: vehicleModel || "Furgon",
      vehicleNo: vehicleNo || "01 A 000 AA",
      driverName: driverName || "Haydovchi",
      driverPhone: driverPhone || "+998 90 000-00-00",
    };
    onSave(profile);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="p-3.5 bg-muted/40 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-blue-600" />
            <span>Tashuvchi va transport ma'lumotlari</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Mashina rusumi, davlat raqami, haydovchi ismi va telefonini bitta joyda kiritish
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tashuvchi / Kompaniya</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PrintGoo Fleet #1"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tashuv turi</Label>
              <Select
                value={type}
                onValueChange={(val: any) => setType(val)}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="fleet">Kompaniya avtoparki (Fleet)</SelectItem>
                  <SelectItem value="courier">Kuryer / Logistika xizmati</SelectItem>
                  <SelectItem value="self">Mijoz o&apos;zi olib ketadi (Samovyvoz)</SelectItem>
                  <SelectItem value="other">Yollanma transport</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Mashina rusumi / modeli</Label>
              <Input
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="ISUZU Furgon 3.5t / Labo"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Davlat raqami</Label>
              <Input
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="01 A 772 BB"
                className="h-7 text-xs font-mono font-bold bg-background"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Haydovchi F.I.Sh.</Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Rustam Ismoilov"
                className="h-7 text-xs bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Haydovchi telefoni</Label>
              <PhoneInput
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+998 90 123-45-67"
                className="h-7 text-xs font-mono bg-background"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Saqlash va tanlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WarehouseShipmentDetail({ tab }: { tab: DocumentTab }) {
  const {
    companiesList,
    loadCompanies,
    warehouseShipments,
    upsertWarehouseShipment,
    upsertWarehouseShipmentAsync,
    replaceTabId,
    productionQueue,
    upsertProductionQueueItem,
    crmCustomers,
    warehouseStock,
    deliveryActs,
    warehousesList,
    loadWarehouses,
    carriersList,
    loadCarriers,
    upsertCarrierAsync,
    plants,
    fetchPlants,
    suppliers,
    loadSuppliers,
    openTab,
    closeTab,
    setTabUnsaved,
    theme,
    dispatchManifests,
    loadDispatchManifests,
    checkAndTriggerReorderAsync,
    finishedGoods,
    loadFinishedGoods,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  // Auto-fetch plants, warehouses, carriers and suppliers if not yet in store
  useEffect(() => {
    if ((!companiesList || companiesList.length === 0) && loadCompanies) {
      loadCompanies();
    }
    if (warehousesList.length === 0 && loadWarehouses) {
      loadWarehouses();
    }
    if (plants.length === 0 && fetchPlants) {
      fetchPlants();
    }
    if (suppliers.length === 0 && loadSuppliers) {
      loadSuppliers();
    }
    if (carriersList.length === 0 && loadCarriers) {
      loadCarriers();
    }
    if ((!dispatchManifests || dispatchManifests.length === 0) && loadDispatchManifests) {
      loadDispatchManifests();
    }
    if ((!finishedGoods || finishedGoods.length === 0) && loadFinishedGoods) {
      loadFinishedGoods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically resolve all real warehouses from plants and postgres warehouses table
  const availableWarehouses = useMemo(() => {
    const list: { id: string; name: string; branch?: string }[] = [];

    // 1. From plant records (each branch/plant has its own warehouses list)
    plants.forEach((p) => {
      if (Array.isArray(p.warehouses) && p.warehouses.length > 0) {
        p.warehouses.forEach((w) => {
          const displayName = plants.length > 1 ? `${p.name} — ${w.name}` : w.name;
          list.push({
            id: w.id || `${p.id}-${w.name}`,
            name: displayName,
            branch: p.name,
          });
        });
      }
    });

    // 2. From postgres warehouses catalog
    (warehousesList || []).forEach((wh: any) => {
      const exists = list.some(
        (item) => item.name.toLowerCase() === wh.name.toLowerCase() || item.id === wh.id
      );
      if (!exists) {
        list.push({
          id: wh.id || wh.name,
          name: wh.name,
        });
      }
    });

    if (list.length === 0) {
      return [
        { id: "wh-1", name: "Asosiy tayyor mahsulot ombori" },
        { id: "wh-2", name: "Xomashyo ombori" },
      ];
    }
    return list;
  }, [plants, warehousesList]);

  // Dynamic recipient branch options from real plants
  const branchList = useMemo(() => {
    if (plants && plants.length > 0) {
      return plants.map((p) => p.name);
    }
    return [
      "Samarqand filiali",
      "Buxoro filiali",
      "Andijon tarqatish markazi",
    ];
  }, [plants]);

  // Dynamic vendor options from real suppliers table
  const vendorList = useMemo(() => {
    if (suppliers && suppliers.length > 0) {
      return suppliers.map((s) => s.name);
    }
    return [
      "Antalis Central Asia",
      "Toyo Ink Uzbekistan",
      "Igepa Group GmbH",
      "Fujifilm CIS",
    ];
  }, [suppliers]);

  // Initialize or read existing document
  const initialDoc = useMemo<WarehouseShipmentRecord>(() => {
    const d = tab.documentData || {};
    const defaultProduct = d.product || "";
    const defaultQty = Number(d.quantity) || 0;
    const defaultUnit = d.unit || "pcs";
    const defaultCustomer = d.customer || d.customerName || "";
    const defaultWo = d.workOrder || d.workOrderId || "";
    const defaultShipmentType: ShipmentType = d.shipmentType || "CustomerDelivery";
    const defaultCompanyId = d.companyId || (companiesList && companiesList[0]?.id) || "";
    const defaultCompanyName = d.companyName || (companiesList && companiesList.find((c: any) => c.id === defaultCompanyId)?.name) || "PrintGoo LLC";

    const defaultItems: ShipmentLineItem[] = Array.isArray(d.items) && d.items.length > 0
      ? d.items
      : defaultProduct && defaultQty > 0
      ? [
          {
            id: `ship-item-${Date.now()}`,
            sku: defaultWo ? `PRN-${defaultWo}` : `PRN-ITEM-1`,
            name: defaultProduct,
            orderQty: defaultQty,
            shippedQty: defaultQty,
            unit: defaultUnit,
            unitPrice: Number(d.unitPrice) || 0,
            totalPrice: Number((defaultQty * (Number(d.unitPrice) || 0)).toFixed(2)),
            packageCount: Math.ceil(defaultQty / 500) || 1,
            packageType: "Gofroquti",
            palletNo: "2810 Ombor",
            notes: "",
          },
        ]
      : [];

    const totalPkg = defaultItems.reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
    const totalWt = defaultItems.reduce((acc, it) => acc + (Number(it.shippedQty) * 0.045 || 0), 0);

    return {
      id: d.id || tab.id,
      dbId: d.dbId || undefined,
      companyId: defaultCompanyId,
      companyName: defaultCompanyName,
      warehouseId: d.warehouseId || undefined,
      date: d.date || new Date().toISOString().split("T")[0],
      customer: defaultCustomer,
      deliveryActId: d.deliveryActId || "",
      workOrder: defaultWo,
      product: defaultProduct,
      quantity: defaultQty,
      unit: defaultUnit,
      from: d.from || availableWarehouses[0]?.name || "Asosiy ombor",
      carrier: d.carrier || DEFAULT_CARRIERS[0].name,
      trackingNo: d.trackingNo || "",
      driverName: d.driverName || DEFAULT_CARRIERS[0].driverName,
      driverPhone: d.driverPhone || DEFAULT_CARRIERS[0].driverPhone,
      vehicleNo: d.vehicleNo || DEFAULT_CARRIERS[0].vehicleNo,
      recipientName: d.recipientName || "",
      powerOfAttorney: d.powerOfAttorney || "",
      packagesCount: Number(d.packagesCount) || totalPkg,
      grossWeightKg: Number(d.grossWeightKg) || Math.round(totalWt),
      volumeM3: Number(d.volumeM3) || 0,
      notes: d.notes || "",
      batchId: d.batchId || undefined,
      batchNo: d.batchNo !== undefined ? Number(d.batchNo) : undefined,
      manifestId: d.manifestId || undefined,
      manifestNumber: d.manifestNumber || undefined,
      deliveryMode: d.deliveryMode || (d.manifestId ? "manifest" : (d.carrier || "").includes("Samovyvoz") ? "self" : ((d.carrier || "").includes("BTS") || (d.carrier || "").includes("Express") || (d.carrier || "").includes("Yandex")) ? "courier" : "dedicated"),
      scannedBoxes: Array.isArray(d.scannedBoxes) ? d.scannedBoxes : [],
      status: d.status || "Draft",
      shipmentType: defaultShipmentType,
      items: defaultItems,
    };
  }, [tab.documentData, tab.id, crmCustomers, productionQueue]);

  const [doc, setDoc] = useState<WarehouseShipmentRecord>(initialDoc);

  const resolvedCarriers = useMemo<CarrierProfile[]>(() => {
    if (carriersList && carriersList.length > 0) {
      return carriersList.map((c) => ({
        id: c.id,
        name: c.name,
        type: (c.type as any) || "fleet",
        vehicleModel: c.vehicleModel || "",
        vehicleNo: c.vehicleNo || "—",
        driverName: c.driverName || "—",
        driverPhone: c.driverPhone || "—",
      }));
    }
    return DEFAULT_CARRIERS;
  }, [carriersList]);

  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [carrierModalData, setCarrierModalData] = useState<Partial<CarrierProfile> | undefined>(undefined);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
  const [isFgPickerOpen, setIsFgPickerOpen] = useState(false);
  const [isTradingPickerOpen, setIsTradingPickerOpen] = useState(false);
  const isLocked = doc.status === "Delivered" || doc.status === "Dispatched" || doc.status === "In Transit";
  const [isManifestDialogOpen, setIsManifestDialogOpen] = useState(false);

  const activeCompany = useMemo(() => {
    return (
      (companiesList || []).find((c: any) => c.id === doc.companyId || c.name === doc.companyName) ||
      companiesList[0] ||
      null
    );
  }, [companiesList, doc.companyId, doc.companyName]);

  const linkedManifest = useMemo(() => {
    if (!doc.manifestId) return null;
    return (dispatchManifests || []).find(
      (m: any) => m.dbId === doc.manifestId || m.id === doc.manifestId || m.manifestNumber === doc.manifestId
    );
  }, [dispatchManifests, doc.manifestId]);

  const totalAmount = useMemo(() => {
    return (doc.items || []).reduce(
      (acc, it) =>
        acc + (Number(it.totalPrice) || ((Number(it.shippedQty) || 0) * (Number(it.unitPrice) || 0)) || 0),
      0
    );
  }, [doc.items]);
  const [scannerMode, setScannerMode] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const [divertModalData, setDivertModalData] = useState<{
    open: boolean;
    scanData: any;
    newBoxes: ScannedBoxEntry[];
    unitPrice: string;
    createReorder: boolean;
  }>({
    open: false,
    scanData: null,
    newBoxes: [],
    unitPrice: "0",
    createReorder: true,
  });

  const applyScannedBoxesToDoc = useCallback(
    (scanData: any, boxesToAdd: ScannedBoxEntry[], confirmedUnitPrice: number, autoFillCustomer: boolean) => {
      if (!boxesToAdd || boxesToAdd.length === 0) return;
      const addedQty = boxesToAdd.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
      const addedWeight = boxesToAdd.reduce((s, b) => s + (Number(b.grossWeightKg) || 0), 0);
      const addedPackages = boxesToAdd.length;

      setDoc((prev) => {
        const existingBoxes = prev.scannedBoxes || [];
        const nextScannedBoxes = [...existingBoxes, ...boxesToAdd];

        const currentItems = [...(prev.items || [])];
        // Check if currentItems has only 1 blank placeholder item
        const hasOnlyBlankPlaceholder =
          currentItems.length === 1 &&
          !currentItems[0].name?.trim() &&
          (Number(currentItems[0].shippedQty) || 0) === 0;

        const targetSku = scanData.sku || `FG-${scanData.workOrderNo}`;
        const existingIdx = hasOnlyBlankPlaceholder
          ? -1
          : currentItems.findIndex(
              (it) =>
                (it.sku && it.sku.toLowerCase() === targetSku.toLowerCase()) ||
                (it.sourceWorkOrderId &&
                  it.sourceWorkOrderId.toLowerCase() === String(scanData.workOrderNo).toLowerCase() &&
                  it.name.toLowerCase() === String(scanData.productName).toLowerCase())
            );

        let nextItems: ShipmentLineItem[];
        if (scanData.mode === "trading_sale_package" && Array.isArray(scanData.items)) {
          const tradingLines: ShipmentLineItem[] = scanData.items.map((it: any, idx: number) => ({
            id: `trd-scan-${Date.now()}-${idx}`,
            sku: it.sku || `SKU-${idx + 1}`,
            name: it.name,
            accountCode: "2910" as const,
            tradingCatalogId: it.tradingCatalogId || it.sku,
            orderQty: Number(it.quantity) || 0,
            shippedQty: Number(it.quantity) || 0,
            unit: it.unit || "dona",
            unitPrice: Number(it.unitPrice) || 0,
            totalPrice: Number(it.totalPrice) || 0,
            packageCount: 1,
            packageType: "Gofroquti",
            palletNo: `2910 [${scanData.workOrderNo || "Savdo"}]`,
            notes: it.notes || "Savdo hujjati stikeri orqali",
          }));

          nextItems = hasOnlyBlankPlaceholder
            ? tradingLines
            : [...currentItems, ...tradingLines];
        } else if (existingIdx >= 0) {
          const item = currentItems[existingIdx];
          const newShipped = (Number(item.shippedQty) || 0) + addedQty;
          const newOrderQty = Math.max(Number(item.orderQty) || 0, newShipped);
          const uPrice = confirmedUnitPrice || Number(item.unitPrice) || 0;
          currentItems[existingIdx] = {
            ...item,
            orderQty: newOrderQty,
            shippedQty: newShipped,
            unitPrice: uPrice,
            totalPrice: Number((newShipped * uPrice).toFixed(2)),
            packageCount: (Number(item.packageCount) || 0) + addedPackages,
            finishedGoodId: item.finishedGoodId || scanData.finishedGoodId || undefined,
            sourceWorkOrderId: item.sourceWorkOrderId || scanData.workOrderNo,
            notes: `${nextScannedBoxes.filter((b) => b.workOrderNo === scanData.workOrderNo).length} ta quti skanerlandi`,
          };
          nextItems = currentItems;
        } else {
          const newLine: ShipmentLineItem = {
            id: `scan-item-${Date.now()}`,
            sku: targetSku,
            name: scanData.productName || "Tayyor mahsulot",
            orderQty: addedQty,
            shippedQty: addedQty,
            unit: scanData.unit || "pcs",
            unitPrice: confirmedUnitPrice,
            totalPrice: Number((addedQty * confirmedUnitPrice).toFixed(2)),
            finishedGoodId: scanData.finishedGoodId || undefined,
            sourceWorkOrderId: scanData.workOrderNo,
            packageCount: addedPackages,
            packageType: "Gofroquti",
            palletNo: boxesToAdd[0]?.boxCode || (scanData.accountCode === "2910" ? "2910 Aksessuarlar" : "Quti pasporti"),
            accountCode: scanData.accountCode || (scanData.tradingCatalogId ? "2910" : "2810"),
            tradingCatalogId: scanData.tradingCatalogId || undefined,
            notes: `Shtrix-kod orqali (${addedPackages} quti)`,
          };
          nextItems = hasOnlyBlankPlaceholder ? [newLine] : [...currentItems, newLine];
        }

        const totalPkg = nextItems.reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
        const totalQty = nextItems.reduce((acc, it) => acc + (Number(it.shippedQty) || 0), 0);

        return {
          ...prev,
          customer: autoFillCustomer ? scanData.customerName || prev.customer : prev.customer,
          workOrder:
            autoFillCustomer || !prev.workOrder || prev.workOrder.startsWith("—")
              ? scanData.workOrderNo || prev.workOrder
              : prev.workOrder,
          tradingSaleId: prev.tradingSaleId || scanData.tradingSaleId || undefined,
          product: prev.product || scanData.productName,
          quantity: totalQty,
          packagesCount: totalPkg,
          grossWeightKg: Number(((Number(prev.grossWeightKg) || 0) + addedWeight).toFixed(2)),
          scannedBoxes: nextScannedBoxes,
          items: nextItems,
        };
      });

      setTabUnsaved(tab.id, true);
      toast.add({
        title: scanData.mode === "trading_sale_package"
          ? `Savdo aksessuarlari stikeri o'qildi: ${scanData.workOrderNo}`
          : boxesToAdd.length > 1
          ? `${boxesToAdd.length} ta quti qo'shildi`
          : `Quti qo'shildi: ${boxesToAdd[0].boxCode}`,
        description: scanData.mode === "trading_sale_package"
          ? `${scanData.items?.length || 1} ta pozitsiya (2910) chiqimga biriktirildi`
          : `${scanData.productName} — +${addedQty.toLocaleString()} ${scanData.unit || "pcs"}`,
        type: "success",
      });
    },
    [setTabUnsaved, tab.id]
  );

  const handleRemoveScannedBox = useCallback(
    (barcodeToRemove: string) => {
      if (isLocked) return;
      setDoc((prev) => {
        const existingBoxes = prev.scannedBoxes || [];
        const targetBox = existingBoxes.find((b) => b.barcode === barcodeToRemove || b.boxCode === barcodeToRemove);
        if (!targetBox) return prev;

        const nextScannedBoxes = existingBoxes.filter((b) => b.barcode !== barcodeToRemove && b.boxCode !== barcodeToRemove);
        const nextItems = (prev.items || [])
          .map((it) => {
            if (
              it.sourceWorkOrderId === targetBox.workOrderNo ||
              it.name.toLowerCase() === targetBox.productName.toLowerCase()
            ) {
              const nextQty = Math.max(0, (Number(it.shippedQty) || 0) - (Number(targetBox.quantity) || 0));
              const nextPkg = Math.max(0, (Number(it.packageCount) || 1) - 1);
              return {
                ...it,
                shippedQty: nextQty,
                orderQty: nextQty,
                packageCount: nextPkg,
                totalPrice: Number((nextQty * (Number(it.unitPrice) || 0)).toFixed(2)),
              };
            }
            return it;
          })
          .filter((it) => Number(it.shippedQty) > 0);

        return {
          ...prev,
          scannedBoxes: nextScannedBoxes,
          grossWeightKg: Math.max(0, Number(((Number(prev.grossWeightKg) || 0) - (Number(targetBox.grossWeightKg) || 0)).toFixed(2))),
          items: nextItems.length > 0 ? nextItems : prev.items,
        };
      });
      setTabUnsaved(tab.id, true);

    },
    [isLocked, setTabUnsaved, tab.id]
  );

  const executeBarcodeScan = useCallback(
    async (rawCode: string) => {
      const code = (rawCode || "").trim();
      if (!code || isLocked || isScanning) return;

      try {
        setIsScanning(true);
        const res = await fetch("/api/v1/warehouse/scan-box", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: code }),
        });
        const data = await res.json();

        if (!data.found) {
          toast.add({
            title: "Shtrix-kod topilmadi",
            description: data.message || `"${code}" bo'yicha quti yoki buyurtma topilmadi.`,
            type: "error",
          });
          return;
        }

        if (data.alreadyDispatched) {
          toast.add({
            title: "Quti allaqachon chiqarilgan",
            description: data.dispatchedShipmentId
              ? `Ushbu quti avval ${data.dispatchedShipmentId} hujjati bilan jo'natilgan.`
              : "Ushbu buyurtmaning barcha qutilari jo'natib bo'lingan.",
            type: "error",
          });
          return;
        }

        const existingCodes = new Set(
          (doc.scannedBoxes || []).flatMap((b) => [b.barcode.toUpperCase(), b.boxCode.toUpperCase()])
        );

        const newBoxes: ScannedBoxEntry[] = (data.boxes || [])
          .filter(
            (b: any) =>
              !existingCodes.has(String(b.barcode || "").toUpperCase()) &&
              !existingCodes.has(String(b.boxCode || "").toUpperCase())
          )
          .map((b: any) => ({
            id: b.id,
            boxNumber: b.boxNumber,
            boxCode: b.boxCode,
            barcode: b.barcode,
            quantity: Number(b.quantity) || 0,
            grossWeightKg: Number(b.grossWeightKg) || 0,
            workOrderNo: data.workOrderNo,
            productName: data.productName,
            customerName: data.customerName,
            sizeCode: b.sizeCode,
            model: b.model,
          }));

        if (newBoxes.length === 0) {
          toast.add({
            title: "Quti allaqachon qo'shilgan",
            description: `"${code}" ushbu chiqim hujjatiga avval skanerlangan.`,
            type: "warning",
          });
          return;
        }

        const currentCustomer = (doc.customer || "").trim();
        const boxOwner = (data.customerName || "").trim();
        const isEmptyCustomer = !currentCustomer || currentCustomer.startsWith("—");
        const isSameCustomer =
          !isEmptyCustomer && currentCustomer.toLowerCase() === boxOwner.toLowerCase();

        if (isEmptyCustomer || isSameCustomer || (doc.shipmentType && doc.shipmentType !== "CustomerDelivery")) {
          applyScannedBoxesToDoc(data, newBoxes, Number(data.unitPrice) || 0, isEmptyCustomer);
        } else {
          // Cross-customer box diversion prompt!
          setDivertModalData({
            open: true,
            scanData: data,
            newBoxes,
            unitPrice: String(data.unitPrice || 0),
            createReorder: true,
          });
        }
      } catch (err) {
        console.error("Barcode scan error:", err);
        toast.add({
          title: "Xatolik",
          description: "Shtrix-kodni tekshirishda tarmoq xatoligi yuz berdi.",
          type: "error",
        });
      } finally {
        setIsScanning(false);
      }
    },
    [applyScannedBoxesToDoc, doc.customer, doc.scannedBoxes, doc.shipmentType, isLocked, isScanning]
  );

  // Global Hardware USB Barcode Scanner HID listener
  useEffect(() => {
    if (!scannerMode || isLocked) return;

    let buffer = "";
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

      const now = Date.now();
      const elapsed = now - lastKeyTime;
      lastKeyTime = now;

      // Hardware scanners type characters very quickly (< 45ms).
      // If delay is longer than 250ms, it is human manual typing, so reset buffer.
      if (elapsed > 250) {
        buffer = "";
      }

      if (e.key === "Enter") {
        if (buffer.length >= 4) {
          e.preventDefault();
          e.stopPropagation();
          const code = buffer.trim();
          buffer = "";
          executeBarcodeScan(code);
        }
        return;
      }

      // Collect alphanumeric characters and dashes
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If user is actively typing in a form input and typing slowly, don't hijack
        if (isInputActive && elapsed > 100 && buffer.length === 0) {
          return;
        }
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [scannerMode, isLocked, executeBarcodeScan]);

  const handleConfirmDivertScan = async () => {
    const { scanData, newBoxes, unitPrice, createReorder } = divertModalData;
    if (!scanData || newBoxes.length === 0) return;

    const totalDivertedQty = newBoxes.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
    const parsedPrice = Number(unitPrice) || 0;

    if (createReorder && checkAndTriggerReorderAsync) {
      await checkAndTriggerReorderAsync({
        originalWorkOrderId: scanData.workOrderNo,
        divertedQty: totalDivertedQty,
        buyerCustomerName: doc.customer,
        notes: `Shtrix-kod skaneri orqali ${newBoxes.length} ta quti ${doc.customer} ga yo'naltirildi`,
      });
    }

    applyScannedBoxesToDoc(scanData, newBoxes, parsedPrice, false);
    setDivertModalData((prev) => ({ ...prev, open: false }));
  };

  const handleSelectTradingItems = (
    items: Array<{
      tradingCatalogId?: string;
      sku: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
      accountCode: "2910";
      notes?: string;
    }>,
    linkedSaleId?: string
  ) => {
    if (isLocked || items.length === 0) return;

    setDoc((prev) => {
      const currentItems = [...(prev.items || [])];
      const hasOnlyBlankPlaceholder =
        currentItems.length === 1 &&
        !currentItems[0].name?.trim() &&
        (Number(currentItems[0].shippedQty) || 0) === 0;

      const boxCode = linkedSaleId ? `TRD-BOX-${linkedSaleId}` : `TRD-BOX-${Date.now().toString().slice(-4)}`;
      const totalBoxQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const boxWeightKg = Number((totalBoxQty * 0.005).toFixed(2)) || 5;

      const newLines: ShipmentLineItem[] = items.map((it, idx) => ({
        id: `trd-item-${Date.now()}-${idx}`,
        sku: it.sku,
        name: it.name,
        accountCode: "2910",
        tradingCatalogId: it.tradingCatalogId,
        orderQty: it.quantity,
        shippedQty: it.quantity,
        unit: it.unit || "dona",
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        packageCount: 1,
        packageType: "Gofroquti",
        palletNo: boxCode,
        notes: it.notes || "Savdo aksessuarlari to'plami",
      }));

      const newBoxEntry: ScannedBoxEntry = {
        id: `box-${boxCode}`,
        boxNumber: (prev.scannedBoxes || []).length + 1,
        boxCode: boxCode,
        barcode: linkedSaleId || boxCode,
        quantity: totalBoxQty,
        grossWeightKg: boxWeightKg,
        workOrderNo: linkedSaleId || "TRD",
        productName: items.map((it) => it.name).slice(0, 2).join(", "),
        customerName: prev.customer,
      };

      const existingBoxes = prev.scannedBoxes || [];
      const hasBoxAlready = existingBoxes.some((b) => b.barcode === (linkedSaleId || boxCode));
      const nextBoxes = hasBoxAlready ? existingBoxes : [...existingBoxes, newBoxEntry];
      const nextWeight = Number(((Number(prev.grossWeightKg) || 0) + (hasBoxAlready ? 0 : boxWeightKg)).toFixed(2));

      const nextItems = hasOnlyBlankPlaceholder
        ? newLines
        : [...currentItems, ...newLines];

      return {
        ...prev,
        tradingSaleId: prev.tradingSaleId || linkedSaleId || undefined,
        scannedBoxes: nextBoxes,
        packagesCount: nextBoxes.length,
        grossWeightKg: nextWeight,
        items: nextItems,
      };
    });

    setTabUnsaved(tab.id, true);
    toast.add({
      title: "Savdo aksessuarlari to'plami biriktirildi",
      description: `${items.length} ta pozitsiya (Hisob 2910) chiqim jadvaliga qo'shildi`,
      type: "success",
    });
  };

  const handleSelectFinishedGoodItem = (fgData: {
    finishedGoodId: string;
    sku: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    sourceWorkOrderId?: string;
    notes?: string;
  }) => {
    if (isLocked) return;
    setDoc((prev) => {
      const currentItems = [...(prev.items || [])];
      const hasOnlyBlankPlaceholder =
        currentItems.length === 1 &&
        !currentItems[0].name?.trim() &&
        (Number(currentItems[0].shippedQty) || 0) === 0;

      const newLine: ShipmentLineItem = {
        id: `fg-item-${Date.now()}`,
        sku: fgData.sku,
        name: fgData.name,
        orderQty: fgData.quantity,
        shippedQty: fgData.quantity,
        unit: fgData.unit || "pcs",
        unitPrice: fgData.unitPrice,
        totalPrice: fgData.totalPrice,
        finishedGoodId: fgData.finishedGoodId,
        sourceWorkOrderId: fgData.sourceWorkOrderId,
        packageCount: Math.max(1, Math.ceil(fgData.quantity / 500)),
        packageType: "Gofroquti",
        palletNo: "2810 Ombor",
        notes: fgData.notes || "",
      };

      const nextItems = hasOnlyBlankPlaceholder ? [newLine] : [...currentItems, newLine];
      return {
        ...prev,
        workOrder: prev.workOrder || fgData.sourceWorkOrderId || "",
        product: prev.product || fgData.name,
        items: nextItems,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const totalShippedQty = useMemo(() => {
    return (doc.items || []).reduce((acc, it) => acc + (Number(it.shippedQty) || 0), 0);
  }, [doc.items]);

  const totalPackages = useMemo(() => {
    return (doc.items || []).reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
  }, [doc.items]);

  const handleFieldChange = (field: keyof WarehouseShipmentRecord, val: any) => {
    if (isLocked) return;
    setDoc((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleShipmentTypeChange = (st: ShipmentType) => {
    if (isLocked) return;
    let defaultRecipient = doc.customer;
    let defaultWo = doc.workOrder;

    if (st === "BranchTransfer") {
      defaultRecipient = BRANCH_RECIPIENTS[0];
      defaultWo = "— (Filiallararo)";
    } else if (st === "Outsourcing") {
      defaultRecipient = SUBCONTRACTORS[0];
      defaultWo = productionQueue[0]?.id || "WOOF-26-0351";
    } else if (st === "VendorReturn") {
      defaultRecipient = VENDORS[0];
      defaultWo = "— (Reklamatsiya)";
    } else if (st === "CustomerDelivery") {
      defaultRecipient = crmCustomers[0]?.name || "Alpha Media Group LLC";
      defaultWo = productionQueue[0]?.id || "WOOF-26-0351";
    }

    setDoc((prev) => ({
      ...prev,
      shipmentType: st,
      customer: defaultRecipient,
      workOrder: defaultWo,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleWorkOrderSelect = (woId: string) => {
    if (isLocked) return;

    if (!woId || woId.startsWith("—") || woId === "direct") {
      setDoc((prev) => ({
        ...prev,
        workOrder: "— (To'g'ridan-to'g'ri chiqim)",
      }));
      setTabUnsaved(tab.id, true);
      return;
    }

    const wo = productionQueue.find((w) => w.id === woId);
    if (!wo) {
      setDoc((prev) => ({ ...prev, workOrder: woId }));
      setTabUnsaved(tab.id, true);
      return;
    }

    const orderQty = wo.quantity || 1000;
    const updatedItems: ShipmentLineItem[] = [
      {
        id: `ship-item-${Date.now()}`,
        sku: `PRN-${wo.id}`,
        name: wo.product,
        orderQty: orderQty,
        shippedQty: orderQty,
        unit: wo.unit || "pcs",
        packageCount: Math.ceil(orderQty / 500) || 5,
        packageType: "Gofroquti",
        palletNo: "Pallet P-01",
        notes: `${wo.id} buyurtmasi bo'yicha`,
      },
    ];

    setDoc((prev) => {
      const isCustomerDelivery = (prev.shipmentType || "CustomerDelivery") === "CustomerDelivery";
      return {
        ...prev,
        workOrder: wo.id,
        customer: isCustomerDelivery ? (wo.customer || prev.customer) : prev.customer,
        product: wo.product,
        quantity: orderQty,
        unit: wo.unit || "pcs",
        packagesCount: Math.ceil(orderQty / 500) || 5,
        grossWeightKg: Math.round(orderQty * 0.05) || 120,
        items: updatedItems,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const handleBatchSelect = (batchId: string) => {
    if (isLocked) return;
    const wo = productionQueue.find((w) => w.id === doc.workOrder);
    if (!wo || !wo.deliveryBatches) return;

    if (!batchId || batchId === "all") {
      setDoc((prev) => ({
        ...prev,
        batchId: undefined,
        batchNo: undefined,
      }));
      setTabUnsaved(tab.id, true);
      return;
    }

    const batch = wo.deliveryBatches.find((b) => b.id === batchId);
    if (!batch) return;

    const bQty = Number(batch.quantity) || 0;
    const rawOrderNo = wo.id;
    const updatedItems: ShipmentLineItem[] =
      batch.sizeItems && batch.sizeItems.filter((si) => si.quantity > 0).length > 0
        ? batch.sizeItems
            .filter((si) => si.quantity > 0)
            .map((si, idx) => ({
              id: `ship-item-${Date.now()}-${idx}`,
              sku: `PRN-${rawOrderNo}-${si.sizeName}`,
              name: `${wo.product} (${si.sizeName})`,
              orderQty: si.quantity,
              shippedQty: si.quantity,
              unit: wo.unit || "pcs",
              packageCount: Math.ceil(si.quantity / 500) || 1,
              packageType: "Gofroquti",
              palletNo: `Pallet P-${batch.batchNo}`,
              notes: `${batch.title} bo'yicha`,
            }))
        : [
            {
              id: `ship-item-${Date.now()}`,
              sku: `PRN-${rawOrderNo}`,
              name: wo.product,
              orderQty: bQty,
              shippedQty: bQty,
              unit: wo.unit || "pcs",
              packageCount: Math.ceil(bQty / 500) || 5,
              packageType: "Gofroquti",
              palletNo: `Pallet P-${batch.batchNo}`,
              notes: `${batch.title} bo'yicha`,
            },
          ];

    setDoc((prev) => ({
      ...prev,
      batchId: batch.id,
      batchNo: batch.batchNo,
      quantity: bQty,
      packagesCount: Math.ceil(bQty / 500) || 5,
      grossWeightKg: Math.round(bQty * 0.05) || 120,
      notes: batch.notes || `${rawOrderNo} ${batch.title} jo'natmasi`,
      items: updatedItems,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleCustomerChange = (newCustomer: string) => {
    if (isLocked) return;

    setDoc((prev) => {
      let nextWorkOrder = prev.workOrder;
      let nextProduct = prev.product;
      let nextItems = prev.items;

      if ((prev.shipmentType || "CustomerDelivery") === "CustomerDelivery") {
        if (!newCustomer) {
          return {
            ...prev,
            customer: "",
          };
        }

        const currentWo = productionQueue.find((w) => w.id === prev.workOrder);
        const isMismatch = currentWo && currentWo.customer?.toLowerCase() !== newCustomer.toLowerCase();

        if (isMismatch || !prev.workOrder || prev.workOrder.startsWith("—")) {
          // Check if this newly picked customer has active orders
          const customerOrders = productionQueue.filter(
            (w) => w.customer && w.customer.toLowerCase() === newCustomer.toLowerCase()
          );

          if (customerOrders.length === 1) {
            // Auto-select if only 1 order exists!
            const autoWo = customerOrders[0];
            const orderQty = autoWo.quantity || 1000;
            nextWorkOrder = autoWo.id;
            nextProduct = autoWo.product;
            nextItems = [
              {
                id: `ship-item-${Date.now()}`,
                sku: `PRN-${autoWo.id}`,
                name: autoWo.product,
                orderQty: orderQty,
                shippedQty: orderQty,
                unit: autoWo.unit || "pcs",
                packageCount: Math.ceil(orderQty / 500) || 5,
                packageType: "Gofroquti",
                palletNo: "Pallet P-01",
                notes: `${autoWo.id} buyurtmasi bo'yicha`,
              },
            ];
          } else {
            // Multiple or 0 orders: reset workOrder so user picks from the filtered list in WorkOrderPicker
            nextWorkOrder = "";
          }
        }
      }

      return {
        ...prev,
        customer: newCustomer,
        workOrder: nextWorkOrder,
        product: nextProduct,
        items: nextItems,
      };
    });
    setTabUnsaved(tab.id, true);
  };

  const handleSelectCarrierProfile = (profile: CarrierProfile) => {
    if (isLocked) return;
    setDoc((prev) => ({
      ...prev,
      carrier: profile.name,
      vehicleNo: profile.vehicleNo,
      driverName: profile.driverName,
      driverPhone: profile.driverPhone,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleSaveCarrierProfile = async (profile: CarrierProfile) => {
    if (isLocked) return;

    if (upsertCarrierAsync) {
      try {
        const saved = await upsertCarrierAsync({
          id: profile.id.startsWith("carrier-") ? undefined : profile.id,
          name: profile.name,
          type: profile.type,
          vehicleModel: profile.vehicleModel,
          vehicleNo: profile.vehicleNo,
          driverName: profile.driverName,
          driverPhone: profile.driverPhone,
          isActive: true,
        });
        if (saved?.id) {
          profile.id = saved.id;
        }
      } catch (err) {
        console.error("Failed to save carrier to database:", err);
      }
    }

    setDoc((prev) => ({
      ...prev,
      carrier: profile.name,
      vehicleNo: profile.vehicleNo,
      driverName: profile.driverName,
      driverPhone: profile.driverPhone,
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleAddStockMaterial = (stockSku: string | null) => {
    if (!stockSku) return;
    const stockItem = warehouseStock.find((s) => s.sku === stockSku);
    if (!stockItem || isLocked) return;

    const newLine: ShipmentLineItem = {
      id: `mat-item-${Date.now()}`,
      sku: stockItem.sku,
      name: stockItem.name,
      orderQty: Math.min(1000, stockItem.available),
      shippedQty: Math.min(1000, stockItem.available),
      unit: stockItem.unit,
      packageCount: 1,
      packageType: "Karton quti / Poddon",
      palletNo: stockItem.location.slice(0, 15),
      notes: `${doc.shipmentType === "BranchTransfer" ? "Filial ehtiyoji uchun" : "Xomashyo jo'natmasi"}`,
    };

    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), newLine],
    }));
    setTabUnsaved(tab.id, true);
    setIsStockPickerOpen(false);
  };

  const isDraft = !doc.id || doc.id.startsWith("draft-") || doc.id.startsWith("new-") || doc.id.startsWith("SHP-NEW-");

  const saveShipmentInternal = async (overrideStatus?: WarehouseShipmentRecord["status"]) => {
    const status = overrideStatus || doc.status;
    const payload = {
      ...doc,
      status,
      shipmentNumber: isDraft ? "" : doc.id,
      quantity: totalShippedQty,
    };
    const res = await upsertWarehouseShipmentAsync(payload);
    if (res && res.shipmentNumber) {
      const realId = res.shipmentNumber;
      const updated = { ...doc, id: realId, status, quantity: totalShippedQty };
      setDoc(updated);
      upsertWarehouseShipment(updated);
      replaceTabId(tab.id, realId, `${realId}: ${updated.customer || "Chiqim"}`, updated);
    } else {
      const updated = { ...doc, status, quantity: totalShippedQty };
      setDoc(updated);
      upsertWarehouseShipment(updated);
    }
    // Live sync with Work Order delivery batches
    if (doc.workOrder && (status === "Dispatched" || status === "Delivered")) {
      const targetWo = productionQueue.find((w) => w.id === doc.workOrder || w.docNo === doc.workOrder);
      if (targetWo && targetWo.deliveryBatches && targetWo.deliveryBatches.length > 0) {
        const batchMatch = targetWo.deliveryBatches.find(
          (b) =>
            (doc.batchId && b.id === doc.batchId) ||
            (doc.batchNo && b.batchNo === doc.batchNo) ||
            (doc.notes && doc.notes.includes(`Partiya #${b.batchNo}`))
        );
        if (batchMatch) {
          const nextBatches = targetWo.deliveryBatches.map((b) =>
            b.id === batchMatch.id
              ? {
                  ...b,
                  status: status === "Delivered" ? ("delivered" as const) : ("dispatched" as const),
                  linkedShipmentId: doc.id,
                  linkedShipmentNo: doc.id,
                  dispatchedAt: new Date().toISOString(),
                }
              : b
          );
          upsertProductionQueueItem({
            ...targetWo,
            deliveryBatches: nextBatches,
          });
        }
      }
    }

    setTabUnsaved(tab.id, false);
  };

  const handleSave = () => {
    saveShipmentInternal();
  };

  const handleDispatch = () => {
    saveShipmentInternal("Dispatched");
  };

  const handleMarkDelivered = () => {
    saveShipmentInternal("Delivered");
  };

  // ─── Glide Data Grid Columns ──────────────────────────────────────────────
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "accountCode", title: "Hisob", width: 95, icon: GridColumnIcon.HeaderLookup },
      { id: "sku", title: "SKU / Artikul", width: 120, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Mahsulot / Xomashyo tavsifi", width: 300, icon: GridColumnIcon.HeaderString },
      { id: "orderQty", title: "Reja miqdori", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "shippedQty", title: "Jo'natilayotgan soni", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birligi", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "unitPrice", title: "Narxi (dona)", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "totalPrice", title: "Jami summa", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "packageCount", title: "Qadoqlar soni", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "packageType", title: "Qadoq turi", width: 150, icon: GridColumnIcon.HeaderLookup },
      { id: "palletNo", title: "Poddon / Joylashuvi", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh", width: 200, icon: GridColumnIcon.HeaderTextTemplate },
    ],
    []
  );

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = (doc.items || [])[row];
      if (!item) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const val = item[column.id as keyof ShipmentLineItem];

      if (column.id === "accountCode") {
        const acc = item.accountCode || (item.tradingCatalogId ? "2910" : "2810");
        const displayLabel = acc === "2910" ? "2910 (Savdo)" : acc === "1010" ? "1010 (Xomashyo)" : "2810 (Tayyor)";
        return {
          kind: GridCellKind.Text,
          data: acc,
          displayData: displayLabel,
          allowOverlay: false,
          themeOverride: {
            textDark: acc === "2910" ? "#3b82f6" : acc === "1010" ? "#8b5cf6" : "#10b981",
            baseFontStyle: "600 11px monospace",
          },
        };
      }

      if (column.id === "shippedQty" || column.id === "orderQty") {
        const numVal = Number(val) || 0;
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: numVal.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
          themeOverride: column.id === "shippedQty" ? {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "600 12px sans-serif",
          } : undefined,
        };
      }

      if (column.id === "unitPrice" || column.id === "totalPrice") {
        const numVal = Number(val) || 0;
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: numVal.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }

      if (column.id === "packageCount") {
        const numVal = Number(val) || 0;
        return {
          kind: GridCellKind.Number,
          data: numVal,
          displayData: String(numVal),
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }

      return {
        kind: GridCellKind.Text,
        data: String(val || ""),
        displayData: String(val || ""),
        allowOverlay: !isLocked,
      };
    },
    [doc.items, columns, isLocked, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newVal: EditableGridCell) => {
      if (isLocked) return;
      const [col, row] = cell;
      const column = columns[col];
      const key = column.id as keyof ShipmentLineItem;

      setDoc((prev) => {
        const updated = [...(prev.items || [])];
        const rowItem = { ...updated[row] };

        if (key === "shippedQty" || key === "orderQty" || key === "packageCount" || key === "unitPrice" || key === "totalPrice") {
          const num = parseFloat((newVal as any).data ?? 0);
          const cleanNum = isNaN(num) ? 0 : num;
          (rowItem as any)[key] = cleanNum;
          if (key === "shippedQty" || key === "unitPrice") {
            const q = key === "shippedQty" ? cleanNum : Number(rowItem.shippedQty) || 0;
            const p = key === "unitPrice" ? cleanNum : Number(rowItem.unitPrice) || 0;
            rowItem.totalPrice = Number((q * p).toFixed(2));
          }
        } else {
          (rowItem as any)[key] = (newVal as any).data ?? "";
        }

        updated[row] = rowItem;
        const nextTotalQty = updated.reduce((s, it) => s + (Number(it.shippedQty) || 0), 0);
        const nextTotalPkg = updated.reduce((s, it) => s + (Number(it.packageCount) || 0), 0);
        return {
          ...prev,
          quantity: nextTotalQty,
          packagesCount: nextTotalPkg,
          items: updated,
        };
      });
      setTabUnsaved(tab.id, true);
    },
    [columns, isLocked, setTabUnsaved, tab.id]
  );

  const handleAddLine = () => {
    if (isLocked) return;
    const newItem: ShipmentLineItem = {
      id: `line-${Date.now()}`,
      sku: `PRN-ITEM-${(doc.items?.length || 0) + 1}`,
      name: doc.shipmentType === "BranchTransfer" ? "Qog'oz / Bo'yoq xomashyosi" : "Bosma mahsulot / Qo'shimcha qism",
      orderQty: 500,
      shippedQty: 500,
      unit: "pcs",
      packageCount: 1,
      packageType: "Gofroquti",
      palletNo: "Pallet P-01",
      notes: "",
    };
    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), newItem],
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleRemoveLine = () => {
    if (isLocked || (doc.items || []).length <= 1) return;
    const rows = selection.rows.toArray();
    if (rows.length === 0) {
      setDoc((prev) => ({
        ...prev,
        items: (prev.items || []).slice(0, -1),
      }));
      setTabUnsaved(tab.id, true);
      return;
    }
    setDoc((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, idx) => !rows.includes(idx)),
    }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  const handleDuplicateLine = () => {
    if (isLocked) return;
    const rows = selection.rows.toArray();
    const sourceIdx = rows.length > 0 ? rows[0] : (doc.items || []).length - 1;
    if (sourceIdx < 0 || !doc.items || !doc.items[sourceIdx]) return;
    const itemToClone = doc.items[sourceIdx];
    const cloned: ShipmentLineItem = {
      ...itemToClone,
      id: `ship-item-${Date.now()}`,
      palletNo: itemToClone.palletNo ? `${itemToClone.palletNo} (nusxa)` : "Pallet P-01",
    };
    setDoc((prev) => ({
      ...prev,
      items: [...(prev.items || []), cloned],
    }));
    setTabUnsaved(tab.id, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === "Insert") {
      e.preventDefault();
      handleAddLine();
    } else if (e.key === "Delete" && (doc.items || []).length > 1) {
      e.preventDefault();
      handleRemoveLine();
    } else if (e.key === "F2") {
      e.preventDefault();
      setScannerMode((prev) => {
        const next = !prev;
        toast.add({
          title: next ? "Skaner rejimi yoqildi" : "Skaner rejimi o'chirildi",
          description: next ? "Skaner apparatdan o'qilgan qutilar avtomatik qabul qilinadi" : "Avtomatik skanerlash to'xtatildi",
          type: "info",
        });
        return next;
      });
    } else if (e.key === "F4" && !e.shiftKey) {
      e.preventDefault();
      setIsFgPickerOpen(true);
    } else if (e.key === "F5") {
      e.preventDefault();
      setIsTradingPickerOpen(true);
    } else if ((e.key === "F4" && e.shiftKey) || e.key === "F3") {
      e.preventDefault();
      setIsStockPickerOpen(true);
    } else if (e.key === "F9") {
      e.preventDefault();
      handleDuplicateLine();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden">
      {/* ─── Top Document Action Bar ─── */}
      <div className="h-10 px-3 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Truck className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-tight truncate">
            <span className={cn(isDraft && "font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded")}>
              {isDraft ? "Yangi" : doc.id}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="truncate text-foreground">
              {doc.customer ? `${doc.customer} (${doc.product})` : (isDraft ? "Yangi chiqim hujjati" : "Ombor chiqimi")}
            </span>
          </div>

          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 font-medium flex items-center gap-1 ${
              doc.status === "Delivered"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                : doc.status === "Dispatched" || doc.status === "In Transit"
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold"
                : doc.status === "Packed"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isLocked && <Lock className="size-2.5" />}
            <span>
              {doc.status === "Delivered"
                ? "Yetkazildi"
                : doc.status === "Dispatched" || doc.status === "In Transit"
                ? "Yuborilgan"
                : doc.status === "Packed"
                ? "Qadoqlangan"
                : "Qoralama"}
            </span>
          </Badge>

          {/* Shipment Type Indicator Badge */}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-mono font-medium hidden sm:inline-flex bg-muted/60 text-muted-foreground"
          >
            {doc.shipmentType === "BranchTransfer"
              ? "Filialga jo'natish"
              : doc.shipmentType === "Outsourcing"
              ? "Subpudratga berish"
              : doc.shipmentType === "VendorReturn"
              ? "Qaytarish"
              : doc.shipmentType === "MaterialSale"
              ? "Xomashyo sotuvi"
              : "Mijozga topshirish"}
          </Badge>

          {tab.isUnsaved && (
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" title="O'zgarishlar saqlanmagan" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Linked Trading Sale Link */}
          {doc.tradingSaleId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                openTab({
                  id: doc.tradingSaleId!,
                  title: `Savdo: ${doc.tradingSaleId}`,
                  type: "trading-sale",
                  module: "trading",
                });
              }}
              className="h-7 px-2 text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15"
              title="Bog'langan savdo hujjati (2910)"
            >
              <ShoppingBag className="size-3 text-blue-600" />
              <span>{doc.tradingSaleId}</span>
            </Button>
          )}

          {/* Work Order Link */}
          {doc.workOrder && doc.workOrder !== "-" && !doc.workOrder.startsWith("—") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                openTab({
                  id: doc.workOrder,
                  title: doc.workOrder,
                  type: "work-order",
                  module: "production",
                });
              }}
              className="h-7 px-2 text-xs gap-1 border-border"
              title="Bog'langan buyurtmani ochish"
            >
              <ExternalLink className="size-3 text-muted-foreground" />
              <span>{doc.workOrder}</span>
            </Button>
          )}

          {/* Linked Reys / Manifest Link */}
          {doc.manifestId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsManifestDialogOpen(true)}
              className="h-7 px-2 text-xs gap-1 border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10"
              title="Biriktirilgan reysni ko'rish"
            >
              <Truck className="size-3 text-blue-600" />
              <span>{doc.manifestNumber || doc.manifestId}</span>
            </Button>
          )}

          {/* Delivery Act (SF) Link */}
          {doc.deliveryActId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const act = deliveryActs.find((a) => a.id === doc.deliveryActId);
                openTab({
                  id: doc.deliveryActId,
                  title: `${doc.deliveryActId}: ${doc.customer}`,
                  type: "delivery-act",
                  module: "sales",
                  documentData: act,
                });
              }}
              className="h-7 px-2 text-xs gap-1 border-border text-primary"
              title="Schet-fakturani ochish"
            >
              <FileText className="size-3" />
              <span>{doc.deliveryActId}</span>
            </Button>
          )}

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Print Waybill */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-7 px-2.5 text-xs gap-1.5 border-border"
          >
            <Printer className="size-3.5" />
            <span>Chop etish</span>
          </Button>

          {/* Save Draft */}
          {!isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 border-border"
            >
              <Save className="size-3.5" />
              <span>Saqlash</span>
            </Button>
          )}

          {/* Revert Packed to Draft */}
          {doc.status === "Packed" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => saveShipmentInternal("Draft")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Qoralama holatiga qaytarish"
            >
              <RotateCcw className="size-3" />
              <span>Qoralama</span>
            </Button>
          )}

          {/* Mark as Packed / Shipment Ready */}
          {doc.status === "Draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveShipmentInternal("Packed")}
              className="h-7 px-2.5 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
            >
              <PackageCheck className="size-3.5" />
              <span>Tayyor yuk</span>
            </Button>
          )}

          {/* Dispatch / Post Button */}
          {doc.status !== "Dispatched" && doc.status !== "Delivered" && doc.status !== "In Transit" && (
            <Button
              size="sm"
              onClick={handleDispatch}
              className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
            >
              <Send className="size-3.5" />
              <span>Chiqarish</span>
            </Button>
          )}

          {/* Revert Dispatched / In Transit back to Packed if dispatched by mistake */}
          {(doc.status === "Dispatched" || doc.status === "In Transit") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => saveShipmentInternal("Packed")}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Qadoqlangan holatiga qaytarish"
            >
              <RotateCcw className="size-3" />
              <span>Qaytarish</span>
            </Button>
          )}

          {(doc.status === "Dispatched" || doc.status === "In Transit") && (
            <Button
              size="sm"
              onClick={handleMarkDelivered}
              className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-none"
            >
              <Check className="size-3.5" />
              <span>Yetkazildi</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => closeTab(tab.id)}
            className="h-7 px-2 text-xs"
          >
            Yopish
          </Button>
        </div>
      </div>

      {/* ─── Document Requisites (6 ta muvozanatli teng ustun) ─── */}
      <div className="p-2.5 bg-card border-b border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5 shrink-0 text-xs">
        {/* Col 1 (span 2): Tashkilot (Yuridik shaxs / Sotuvchi) */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">
            Tashkilot (Yuridik shaxs)
          </Label>
          {isLocked ? (
            <Input
              value={activeCompany?.name || doc.companyName || "Asosiy korxona"}
              readOnly
              className="h-7 text-xs bg-muted/40 font-medium w-full"
            />
          ) : (
            <Select
              value={doc.companyId || (companiesList[0]?.id ?? "")}
              disabled={isLocked}
              onValueChange={(compVal) => {
                const found = (companiesList || []).find((c: any) => c.id === compVal);
                setDoc((prev) => ({
                  ...prev,
                  companyId: compVal,
                  companyName: found?.name || prev.companyName,
                }));
                setTabUnsaved(tab.id, true);
              }}
            >
              <SelectTrigger className="h-7 w-full text-xs bg-background">
                <SelectValue placeholder="Tashkilot..." />
              </SelectTrigger>
              <SelectContent>
                {(companiesList || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="font-medium">{c.name}</span>
                    {c.inn && <span className="ml-1 text-[10px] text-muted-foreground font-mono">({c.inn})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Col 2 (span 2): Chiqim turi */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">
            Chiqim turi
          </Label>
          {isLocked ? (
            <Input
              value={
                doc.shipmentType === "BranchTransfer"
                  ? "Filialga jo'natish"
                  : doc.shipmentType === "Outsourcing"
                  ? "Subpudratga berish"
                  : doc.shipmentType === "VendorReturn"
                  ? "Yetkazib beruvchiga qaytarish"
                  : doc.shipmentType === "MaterialSale"
                  ? "Xomashyo sotuvi"
                  : "Mijozga topshirish"
              }
              readOnly
              className="h-7 text-xs bg-muted/40 font-medium w-full"
            />
          ) : (
            <ShipmentTypeCombobox
              value={doc.shipmentType || "CustomerDelivery"}
              onChange={handleShipmentTypeChange}
              disabled={isLocked}
            />
          )}
        </div>

        {/* Col 3 (span 2): Hujjat raqami */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">Hujjat raqami</Label>
          <Input
            value={isDraft ? "Yangi" : doc.id}
            readOnly
            className="h-7 text-xs font-mono bg-muted/40 font-bold w-full text-muted-foreground"
          />
        </div>

        {/* Col 4 (span 2): Hujjat sanasi */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium">Hujjat sanasi</Label>
          <DatePicker
            value={doc.date}
            disabled={isLocked}
            onChange={(val) => handleFieldChange("date", val)}
            formatString="dd.MM.yyyy"
            className="h-7 text-xs font-mono bg-background w-full"
          />
        </div>

        {/* Col 5 (span 2): Asos / Buyurtma */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground font-medium">
              {doc.shipmentType === "BranchTransfer" ? "Asos hujjati" : "Buyurtma"}
            </Label>
            {doc.workOrder && !doc.workOrder.startsWith("—") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                № {doc.workOrder}
              </span>
            )}
          </div>
          {doc.shipmentType === "BranchTransfer" || doc.shipmentType === "VendorReturn" ? (
            <Input
              value={doc.workOrder}
              readOnly={isLocked}
              onChange={(e) => handleFieldChange("workOrder", e.target.value)}
              className="h-7 text-xs font-mono bg-background w-full"
              placeholder="Asos hujjati..."
            />
          ) : (
            <WorkOrderPicker
              value={doc.workOrder}
              disabled={isLocked}
              orders={productionQueue}
              customer={doc.customer}
              onSelect={handleWorkOrderSelect}
            />
          )}

          {(() => {
            const currentWo = productionQueue.find((w) => w.id === doc.workOrder);
            if (!currentWo || !currentWo.deliveryBatches || currentWo.deliveryBatches.length === 0) return null;
            return (
              <div className="mt-1">
                <Select
                  value={doc.batchId || "all"}
                  disabled={isLocked}
                  onValueChange={(val) => handleBatchSelect(val || "all")}
                >
                  <SelectTrigger className="h-6 text-[10px] font-mono border-dashed border-primary/40 bg-primary/5 text-primary">
                    <SelectValue placeholder="Partiyani tanlash" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Barcha adad (Taqsimlanmagan)
                    </SelectItem>
                    {currentWo.deliveryBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        {b.title} ({(Number(b.quantity) || 0).toLocaleString()} {doc.unit || "dona"}) · {b.targetDate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}
        </div>

        {/* Col 6 (span 2): Qabul qiluvchi */}
        <div className="sm:col-span-1 md:col-span-1 lg:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground font-medium truncate">
              {doc.shipmentType === "BranchTransfer"
                ? "Qabul qiluvchi filial"
                : doc.shipmentType === "Outsourcing"
                ? "Subpudrat sexi"
                : doc.shipmentType === "VendorReturn"
                ? "Yetkazib beruvchi"
                : "Qabul qiluvchi"}
            </Label>
            {doc.shipmentType === "CustomerDelivery" && doc.workOrder && !doc.workOrder.startsWith("—") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                <Link2 className="size-3" />
                <span>{doc.workOrder}</span>
              </span>
            )}
          </div>
          <RecipientCombobox
            value={doc.customer}
            onChange={handleCustomerChange}
            shipmentType={doc.shipmentType || "CustomerDelivery"}
            customers={crmCustomers}
            branches={branchList}
            subcontractors={SUBCONTRACTORS}
            vendors={vendorList}
            disabled={isLocked}
            isAutoLinked={Boolean(doc.shipmentType === "CustomerDelivery" && doc.workOrder && !doc.workOrder.startsWith("—"))}
          />
        </div>
      </div>

      {/* ─── Contextual Transport Strip (Ultra-ixcham va to'liq sinxronlangan) ─── */}
      <div className="h-9 px-3 bg-muted/20 border-b border-border flex items-center justify-between gap-2.5 text-xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 1. Chiqaruvchi ombor */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">Ombor:</span>
            {isLocked ? (
              <span className="font-medium text-foreground text-xs truncate max-w-[160px]">{doc.from}</span>
            ) : (
              <WarehouseSelect
                value={doc.from}
                onValueChange={(val: WarehouseSelectValue) => {
                  setDoc((prev) => ({
                    ...prev,
                    from: val.warehouseName,
                    warehouseId: val.warehouseId,
                    companyId: prev.companyId || val.companyId || undefined,
                    companyName: prev.companyName || val.companyName || undefined,
                  }));
                  setTabUnsaved(tab.id, true);
                }}
                className="w-[160px] sm:w-[190px] shrink-0 h-7 text-xs"
                disabled={isLocked}
              />
            )}
          </div>

          <Separator orientation="vertical" className="h-3.5 shrink-0" />

          {/* 2. Yetkazish usuli */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">Yetkazish:</span>
            <Select
              value={doc.deliveryMode || (doc.manifestId ? "manifest" : "dedicated")}
              disabled={isLocked}
              onValueChange={(val) => {
                if (!val) return;
                const mode = val as "manifest" | "dedicated" | "self" | "courier";
                setDoc((prev) => {
                  const updates: Partial<WarehouseShipmentRecord> = { deliveryMode: mode };
                  if (mode === "self") {
                    updates.carrier = "Mijoz olib ketadi (Samovyvoz)";
                    updates.vehicleNo = "—";
                    updates.driverName = "Mijoz vakili";
                    updates.manifestId = undefined;
                    updates.manifestNumber = undefined;
                  } else if (mode === "courier") {
                    const firstCourier = resolvedCarriers.find((c) => c.type === "courier") || resolvedCarriers[3] || {
                      name: "BTS Express Pochta",
                      vehicleNo: "01 B 707 TS",
                      driverName: "BTS Kuryer",
                    };
                    updates.carrier = firstCourier.name;
                    updates.vehicleNo = firstCourier.vehicleNo || "—";
                    updates.driverName = firstCourier.driverName || "Kuryer";
                    updates.manifestId = undefined;
                    updates.manifestNumber = undefined;
                  } else if (mode === "dedicated") {
                    const firstFleet = resolvedCarriers.find((c) => c.type === "fleet") || resolvedCarriers[0] || {
                      name: "PrintGoo Fleet #1 (ISUZU)",
                      vehicleNo: "01 A 772 BB",
                      driverName: "Rustam Ismoilov",
                    };
                    updates.carrier = firstFleet.name;
                    updates.vehicleNo = firstFleet.vehicleNo;
                    updates.driverName = firstFleet.driverName;
                    updates.manifestId = undefined;
                    updates.manifestNumber = undefined;
                  } else if (mode === "manifest" && (!prev.status || prev.status === "Draft")) {
                    updates.status = "Packed";
                  }
                  return { ...prev, ...updates };
                });
                setTabUnsaved(tab.id, true);
              }}
            >
              <SelectTrigger className="h-7 w-[124px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dedicated" className="text-xs">Alohida mashina</SelectItem>
                <SelectItem value="manifest" className="text-xs">Reys orqali</SelectItem>
                <SelectItem value="self" className="text-xs">Mijoz olib ketadi</SelectItem>
                <SelectItem value="courier" className="text-xs">Kuryer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-3.5 shrink-0" />

          {/* 3. Kontekstual Tashuvchi / Reys / Ishonchnoma (Faqat tegishlisi ko'rinadi) */}

          {/* A. Reys orqali tanlanganda */}
          {doc.deliveryMode === "manifest" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Reys:</span>
              <Select
                value={doc.manifestId || "PENDING_MANIFEST"}
                disabled={isLocked}
                onValueChange={(mId) => {
                  if (!mId || mId === "PENDING_MANIFEST") {
                    setDoc((prev) => ({
                      ...prev,
                      manifestId: undefined,
                      manifestNumber: undefined,
                    }));
                    setTabUnsaved(tab.id, true);
                    return;
                  }
                  const foundMnf = (dispatchManifests || []).find(
                    (m: any) => m.dbId === mId || m.id === mId || m.manifestNumber === mId
                  );
                  if (foundMnf) {
                    setDoc((prev) => ({
                      ...prev,
                      manifestId: foundMnf.dbId || foundMnf.id,
                      manifestNumber: foundMnf.manifestNumber || foundMnf.id,
                      carrier: `${foundMnf.vehicleModel || "Reys"} (${foundMnf.vehiclePlate || ""})`.trim(),
                      vehicleNo: foundMnf.vehiclePlate || prev.vehicleNo,
                      driverName: foundMnf.driverName || prev.driverName,
                      driverPhone: foundMnf.driverPhone || prev.driverPhone,
                      trackingNo: foundMnf.manifestNumber || foundMnf.id,
                    }));
                    setTabUnsaved(tab.id, true);
                  }
                }}
              >
                <SelectTrigger className="h-7 w-[190px] text-xs font-mono bg-blue-500/5 border-blue-500/30 text-blue-700 dark:text-blue-300">
                  <SelectValue placeholder="Reysga biriktiriladi..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING_MANIFEST" className="text-xs">
                    Tayyor yuk (Reysga biriktiriladi)
                  </SelectItem>
                  {(dispatchManifests || []).map((m: any) => (
                    <SelectItem key={m.dbId || m.id} value={m.dbId || m.id} className="text-xs font-mono">
                      {m.manifestNumber || m.id} • {m.vehiclePlate || m.vehicleModel || "Avto"} ({m.driverName || "Haydovchi"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* B. Alohida mashina (Fleet) tanlanganda */}
          {doc.deliveryMode === "dedicated" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">Tashuvchi:</span>
              {isLocked ? (
                <span className="font-medium text-foreground text-xs flex items-center gap-1">
                  <span>{doc.carrier}</span>
                  {doc.vehicleNo && doc.vehicleNo !== "—" && (
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted font-bold">
                      {doc.vehicleNo}
                    </span>
                  )}
                </span>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <CarrierCombobox
                    carrier={doc.carrier}
                    vehicleNo={doc.vehicleNo}
                    driverName={doc.driverName}
                    driverPhone={doc.driverPhone}
                    carriers={resolvedCarriers.filter((c) => c.type !== "courier" && c.type !== "self")}
                    onSelect={handleSelectCarrierProfile}
                    onAddNew={() => {
                      setCarrierModalData({
                        name: "PrintGoo Fleet",
                        vehicleModel: "",
                        vehicleNo: "",
                        driverName: "",
                        driverPhone: "",
                        type: "fleet",
                      });
                      setIsCarrierModalOpen(true);
                    }}
                    onOpenCatalog={() => {
                      openTab({
                        id: "tab-warehouse-carriers",
                        title: "Carriers",
                        type: "registry",
                        module: "warehouse",
                      });
                    }}
                    className="w-[190px] sm:w-[220px] shrink-0"
                    disabled={isLocked}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCarrierModalData({
                        name: doc.carrier || "PrintGoo Fleet #1",
                        vehicleModel: doc.carrier.includes("(") ? doc.carrier.split("(")[1]?.replace(")", "") || "" : "Furgon",
                        vehicleNo: doc.vehicleNo || "",
                        driverName: doc.driverName || "",
                        driverPhone: doc.driverPhone || "",
                        type: "fleet",
                      });
                      setIsCarrierModalOpen(true);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground border border-border/50 shrink-0"
                    title="Tashuvchini tahrirlash"
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* C. Mijoz o'zi olib ketadi (Samovyvoz) tanlanganda */}
          {doc.deliveryMode === "self" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                <FileText className="size-3" />
                Ishonchnoma:
              </span>
              <Input
                value={doc.powerOfAttorney || ""}
                readOnly={isLocked}
                onChange={(e) => handleFieldChange("powerOfAttorney", e.target.value)}
                placeholder="№ 15 / 12.11.2026 dan (ixtiyoriy)"
                className="h-7 w-[180px] text-xs font-mono bg-background"
                title="Mijoz vakilining yuridik ishonchnomasi"
              />
            </div>
          )}

          {/* D. Kuryer tanlanganda */}
          {doc.deliveryMode === "courier" && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium shrink-0">Kuryer:</span>
                <CarrierCombobox
                  carrier={doc.carrier}
                  vehicleNo={doc.vehicleNo}
                  driverName={doc.driverName}
                  driverPhone={doc.driverPhone}
                  carriers={resolvedCarriers.filter((c) => c.type === "courier")}
                  onSelect={handleSelectCarrierProfile}
                  className="w-[160px] shrink-0"
                  disabled={isLocked}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium shrink-0">Trek №:</span>
                <Input
                  value={doc.trackingNo || ""}
                  readOnly={isLocked}
                  onChange={(e) => handleFieldChange("trackingNo", e.target.value)}
                  placeholder="TRK..."
                  className="h-7 w-[100px] text-xs font-mono bg-background text-primary font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. O'ng tomon: Qo'shimcha (m³, izoh) */}
        <div className="flex items-center gap-2 shrink-0">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 border border-border/40 shrink-0"
                >
                  <SlidersHorizontal className="size-3" />
                  <span>Qo'shimcha</span>
                  {(doc.notes || doc.volumeM3) && (
                    <span className="size-1.5 rounded-full bg-blue-600" />
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-3 text-xs space-y-2.5 border border-border shadow-xl" align="end">
              <div className="font-semibold text-xs text-foreground pb-1 border-b border-border">
                Ixtiyoriy qo'shimcha ma'lumotlar
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Yuk hajmi (m³)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={doc.volumeM3 || ""}
                  readOnly={isLocked}
                  onChange={(e) => handleFieldChange("volumeM3", Number(e.target.value))}
                  placeholder="0.00 m³"
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Yuk jo'natish izohi / Eslatma</Label>
                <Input
                  value={doc.notes || ""}
                  readOnly={isLocked}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Ehtiyotkorlik bilan yetkazilsin..."
                  className="h-7 text-xs bg-background"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ─── Table Toolbar (Tovarlar spetsifikatsiyasi & Shtrix-kod skaneri) ─── */}
      <div className="h-9 px-3 bg-muted/50 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Boxes className="size-3.5 text-muted-foreground" />
            <span>Tovarlar</span>
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-background font-mono">
            {(doc.items || []).length} qator
          </Badge>

          {/* Attached Scanned Boxes Popover (Always accessible) */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-[11px] gap-1 font-mono transition-colors",
                    (doc.scannedBoxes?.length ?? 0) > 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <QrCode className="size-3" />
                  <span>Qutilar: {doc.scannedBoxes?.length ?? 0} ta</span>
                </Button>
              }
            />
            <PopoverContent className="w-96 p-2.5 text-xs border border-border shadow-xl" align="start">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
                <span className="font-semibold text-foreground">Skanerlangan qutilar ro&apos;yxati</span>
                <span className="font-mono text-[11px] text-muted-foreground">{doc.scannedBoxes?.length ?? 0} quti</span>
              </div>
              {(doc.scannedBoxes?.length ?? 0) === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Hali qutilar skanerlanmagan. F2 tugmasini bosing yoki shtrix-kod kiriting.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {(doc.scannedBoxes || []).map((bx) => (
                    <div
                      key={bx.barcode}
                      className="flex items-center justify-between px-2 py-1 rounded bg-muted/40 border border-border/60 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-foreground flex items-center gap-1.5">
                          <span>{bx.boxCode}</span>
                          <span className="text-muted-foreground">({bx.barcode})</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {bx.productName} • <b className="font-mono text-foreground">{bx.quantity.toLocaleString()}</b> dona • {bx.grossWeightKg} kg
                        </div>
                      </div>
                      {!isLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveScannedBox(bx.barcode)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Scanner Hardware Auto-detect Toggle (F2) */}
        <div className="flex items-center gap-1.5">
          {!isLocked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScannerMode((prev) => {
                  const next = !prev;
                  toast.add({
                    title: next ? "Skaner rejimi yoqildi" : "Skaner rejimi o'chirildi",
                    description: next ? "Skaner apparatdan o'qilgan qutilar avtomatik qabul qilinadi" : "Avtomatik skanerlash to'xtatildi",
                    type: "info",
                  });
                  return next;
                });
              }}
              className={cn(
                "h-7 px-2.5 text-xs gap-1.5 transition-colors cursor-pointer select-none",
                scannerMode
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
              title="Skaner apparatdan to'g'ridan-to'g'ri qabul qilish rejimi (F2)"
            >
              <QrCode className={cn("size-3.5", scannerMode ? "text-emerald-600 animate-pulse" : "text-muted-foreground")} />
              <span className="font-medium">
                {scannerMode ? "Skaner faol" : "Skaner rejimi"}
              </span>
              {scannerMode && (
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
              )}
              <kbd className="text-[10px] font-mono opacity-60">F2</kbd>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Tabular Grid Section (Glide Data Grid with Context Menu) ─── */}
      <div
        className="flex-1 w-full min-h-0 bg-background relative overflow-hidden outline-none focus:outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="w-full h-full">
              <DataEditor
                width="100%"
                height="100%"
                rows={(doc.items || []).length}
                columns={columns}
                getCellContent={getContent}
                onCellEdited={handleCellEdited}
                gridSelection={selection}
                onGridSelectionChange={setSelection}
                onCellContextMenu={(cell) => {
                  const [, row] = cell;
                  if (row !== undefined && row >= 0) {
                    setSelection({
                      columns: CompactSelection.empty(),
                      rows: CompactSelection.fromSingleSelection(row),
                    });
                  }
                }}
                rowMarkers="both"
                freezeColumns={1}
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                smoothScrollX
                smoothScrollY
              />
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-60 text-xs">
            <ContextMenuItem onClick={handleAddLine} disabled={isLocked} className="gap-2 cursor-pointer">
              <Plus className="size-3.5 text-blue-600" />
              <span>Yangi satr qo'shish</span>
              <ContextMenuShortcut>Ins</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setIsFgPickerOpen(true)}
              disabled={isLocked}
              className="gap-2 cursor-pointer"
            >
              <PackageCheck className="size-3.5 text-emerald-600" />
              <span>Tayyor mahsulot (2810)</span>
              <ContextMenuShortcut>F4</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setIsTradingPickerOpen(true)}
              disabled={isLocked}
              className="gap-2 cursor-pointer"
            >
              <ShoppingBag className="size-3.5 text-blue-600" />
              <span>Savdo aksessuarlari (2910)</span>
              <ContextMenuShortcut>F5</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setIsStockPickerOpen(true)}
              disabled={isLocked}
              className="gap-2 cursor-pointer"
            >
              <Boxes className="size-3.5 text-indigo-500" />
              <span>Xomashyo ombori (1010)</span>
              <ContextMenuShortcut>Shift+F4</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleDuplicateLine}
              disabled={isLocked || (doc.items || []).length === 0}
              className="gap-2 cursor-pointer"
            >
              <Layers className="size-3.5 text-indigo-500" />
              <span>Qatordan nusxa olish</span>
              <ContextMenuShortcut>F9</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={handleRemoveLine}
              disabled={isLocked || (doc.items || []).length <= 1}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Tanlangan satrni o'chirish</span>
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Empty state hint when 0 rows */}
        {(doc.items || []).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none bg-background/50">
            <div className="size-9 rounded bg-muted flex items-center justify-center text-muted-foreground mb-1.5">
              <Boxes className="size-4 opacity-60" />
            </div>
            <p className="text-xs font-semibold text-foreground">Chiqim jadvali bo&apos;sh</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
              Shtrix-kod skanerlang (F2), tayyor mahsulot (F4), aksessuarlar (F5) yoki xomashyo (Shift+F4) qo&apos;shing
            </p>
          </div>
        )}
      </div>

      {/* ─── Footer Summary Bar ─── */}
      <div className="h-8 px-3 bg-card border-t border-border flex items-center justify-between shrink-0 text-xs font-medium">
        <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
          <span>
            Jami qatorlar: <b className="text-foreground">{(doc.items || []).length}</b>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span>
            Jami qadoqlar: <b className="text-foreground">{totalPackages || doc.packagesCount || 0} ta quti</b>
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span>
            Umumiy vazn: <b className="text-foreground">{doc.grossWeightKg || 0} kg</b>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Jami qiymat:</span>
            <span className="text-sm font-semibold font-mono text-foreground">
              {totalAmount.toLocaleString()} so'm
            </span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Chiqarilayotgan adad:</span>
            <span className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400">
              {totalShippedQty.toLocaleString()} {doc.unit || "dona"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Printable Waybill Dialog (Tovar-transport yuk xati) ─── */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border border-border shadow-2xl">
          <DialogHeader className="p-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="size-4 text-blue-600" />
                <span>
                  {doc.shipmentType === "BranchTransfer"
                    ? "FILIALLARARO YUK XATI"
                    : doc.shipmentType === "Outsourcing"
                    ? "SUBPUDRAT YUK XATI"
                    : "TOVAR-TRANSPORT YUK XATI"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Chop etish va haydovchi/qabul qiluvchi imzolashi uchun rasmiy yo'l hujjati
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Printable Document Sheet Preview */}
          <div className="p-6 bg-white text-zinc-950 font-sans text-xs space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h1 className="text-base font-black tracking-tight uppercase">
                  {activeCompany?.name || activeCompany?.legalName || doc.companyName || "PRINTGOO POLIGRAFIYA MCHJ"}
                </h1>
                <p className="text-[11px] text-zinc-600">
                  {activeCompany?.address || "Toshkent sh., Chilonzor tumani, Sanoat hududi 12"}
                </p>
                <p className="text-[11px] text-zinc-600 font-mono">
                  Tel: {activeCompany?.phone || "+998 71 200-00-00"} | STIR: {activeCompany?.inn || "305841920"}
                  {activeCompany?.bankName ? ` | Bank: ${activeCompany.bankName}` : ""}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold font-mono">Hujjat № {doc.id}</div>
                <div className="text-[11px] text-zinc-600 font-mono">Sana: {doc.date}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Yuk xati: {doc.trackingNo || doc.id}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] p-2.5 rounded bg-zinc-50 border border-zinc-200">
              <div>
                <p><b className="text-zinc-700">Chiqaruvchi tashkilot:</b> <span className="font-semibold text-zinc-900">{activeCompany?.name || doc.companyName || "Asosiy korxona"}</span></p>
                <p><b className="text-zinc-700">Jismoniy ombor:</b> {doc.from}</p>
                <p><b className="text-zinc-700">Tashuvchi:</b> {doc.carrier}</p>
                <p><b className="text-zinc-700">Haydovchi:</b> {doc.driverName} ({doc.vehicleNo}) {doc.driverPhone && doc.driverPhone !== "—" ? `• Tel: ${doc.driverPhone}` : ""}</p>
              </div>
              <div>
                <p><b className="text-zinc-700">Qabul qiluvchi mijoz:</b> <span className="font-semibold text-zinc-900">{doc.customer}</span></p>
                <p><b className="text-zinc-700">Buyurtma / Asos:</b> {doc.workOrder}</p>
                <p><b className="text-zinc-700">Ishonchnoma:</b> {doc.powerOfAttorney || "Talab etilmaydi (Firma yetkazmasi)"}</p>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse border border-zinc-300 text-[11px]">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-300">
                  <th className="p-1.5 border-r border-zinc-300 w-8 text-center">№</th>
                  <th className="p-1.5 border-r border-zinc-300">Mahsulot / Xomashyo nomi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-20 text-right">Miqdori</th>
                  <th className="p-1.5 border-r border-zinc-300 w-14 text-center">Birligi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-20 text-right">Narxi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-24 text-right">Summasi</th>
                  <th className="p-1.5 border-r border-zinc-300 w-16 text-center">Qadoq</th>
                  <th className="p-1.5 text-center w-20">Joylashuvi</th>
                </tr>
              </thead>
              <tbody>
                {(doc.items || []).map((it, idx) => {
                  const uPrice = Number(it.unitPrice) || 0;
                  const rowSum = Number(it.totalPrice) || ((Number(it.shippedQty) || 0) * uPrice);
                  return (
                    <tr key={it.id} className="border-b border-zinc-200">
                      <td className="p-1.5 border-r border-zinc-200 text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border-r border-zinc-200 font-medium">{it.name}</td>
                      <td className="p-1.5 border-r border-zinc-200 text-right font-mono font-bold">
                        {Number(it.shippedQty).toLocaleString()}
                      </td>
                      <td className="p-1.5 border-r border-zinc-200 text-center">{it.unit}</td>
                      <td className="p-1.5 border-r border-zinc-200 text-right font-mono">
                        {uPrice > 0 ? uPrice.toLocaleString() : "—"}
                      </td>
                      <td className="p-1.5 border-r border-zinc-200 text-right font-mono font-semibold">
                        {rowSum > 0 ? rowSum.toLocaleString() : "—"}
                      </td>
                      <td className="p-1.5 border-r border-zinc-200 text-center font-mono">{it.packageCount || 1} quti</td>
                      <td className="p-1.5 text-center font-mono text-[10px]">{it.palletNo || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-bold border-t border-zinc-300">
                  <td colSpan={2} className="p-1.5 text-right border-r border-zinc-300">Jami:</td>
                  <td className="p-1.5 text-right font-mono text-blue-700">{totalShippedQty.toLocaleString()}</td>
                  <td className="p-1.5 text-center">{doc.unit}</td>
                  <td className="p-1.5 text-center font-mono text-zinc-500">—</td>
                  <td className="p-1.5 text-right font-mono text-blue-700">{totalAmount.toLocaleString()}</td>
                  <td className="p-1.5 text-center font-mono">{totalPackages} quti</td>
                  <td className="p-1.5 text-center font-mono text-[10px]">{doc.grossWeightKg} kg</td>
                </tr>
              </tfoot>
            </table>

            {/* Signature section */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-[11px]">
              <div className="space-y-6">
                <div>
                  <p className="font-semibold">Topshirdi (Ombor mudiri):</p>
                  <p className="text-zinc-600">D. Karimov ___________________</p>
                </div>
                <div className="text-[10px] text-zinc-400">M.O'. (Muhr o'rni)</div>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="font-semibold">Qabul qildi (Haydovchi / Vakil):</p>
                  <p className="text-zinc-600">{doc.driverName ? doc.driverName.split(" ")[0] : "Haydovchi"} ___________________</p>
                </div>
                <div className="text-[10px] text-zinc-400">Imzo & Qabul vaqti: ____________</div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 bg-muted/40 border-t border-border flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPrintModalOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                window.print();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Chop etish (Ctrl+P)</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ombordan xomashyo tanlash Dialogi (F4 yoki Kontekst Menyu) ─── */}
      <StockMaterialDialog
        open={isStockPickerOpen}
        onOpenChange={setIsStockPickerOpen}
        stock={warehouseStock}
        onSelectMaterial={handleAddStockMaterial}
      />

      {/* ─── Tashuvchi va Haydovchi ma'lumotlarini kiritish / tahrirlash Dialogi ─── */}
      <CarrierDialog
        open={isCarrierModalOpen}
        onOpenChange={setIsCarrierModalOpen}
        initialData={carrierModalData}
        onSave={handleSaveCarrierProfile}
      />

      {/* ─── 2810 Tayyor Mahsulot Omboridan tanlash Dialogi ─── */}
      <PickFinishedGoodsDialog
        open={isFgPickerOpen}
        onOpenChange={setIsFgPickerOpen}
        buyerCustomer={doc.customer}
        onSelectFgItem={handleSelectFinishedGoodItem}
      />

      {/* ─── 2910 Savdo Aksessuarlari Omboridan tanlash Dialogi ─── */}
      <PickTradingCatalogDialog
        open={isTradingPickerOpen}
        onOpenChange={setIsTradingPickerOpen}
        buyerCustomer={doc.customer}
        onSelectItems={handleSelectTradingItems}
      />

      {/* ─── Biriktirilgan Reys / Manifest Dialogi ─── */}
      <DispatchManifestDialog
        open={isManifestDialogOpen}
        onOpenChange={setIsManifestDialogOpen}
        manifest={linkedManifest}
      />

      {/* ─── Boshqa mijoz qutisini yo'naltirish (Cross-Customer Barcode Scan) Dialogi ─── */}
      <Dialog
        open={divertModalData.open}
        onOpenChange={(open) => setDivertModalData((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 border border-border bg-card">
          <DialogHeader className="px-4 py-3 border-b border-border bg-amber-500/10">
            <DialogTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              <span>Boshqa mijoz zaxirasidan yo&apos;naltirish</span>
            </DialogTitle>
          </DialogHeader>

          {divertModalData.scanData && (
            <div className="p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded border border-border bg-muted/30 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Asl buyurtmachi:</span>
                  <span className="font-semibold text-foreground">{divertModalData.scanData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qabul qiluvchi mijoz:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{doc.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mahsulot:</span>
                  <span className="font-medium text-foreground">{divertModalData.scanData.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skanerlangan qutilar:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {divertModalData.newBoxes.length} quti ({divertModalData.newBoxes.reduce((s, b) => s + b.quantity, 0).toLocaleString()} {divertModalData.scanData.unit || "pcs"})
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  {doc.customer} uchun sotuv narxi (1 dona uchun)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={divertModalData.unitPrice}
                  onChange={(e) => setDivertModalData((prev) => ({ ...prev, unitPrice: e.target.value }))}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <label className="flex items-start gap-2 p-2 rounded border border-border bg-muted/20 cursor-pointer">
                <Checkbox
                  checked={divertModalData.createReorder}
                  onCheckedChange={(checked) =>
                    setDivertModalData((prev) => ({ ...prev, createReorder: Boolean(checked) }))
                  }
                  className="mt-0.5"
                />
                <span className="text-[11px] text-foreground leading-tight">
                  <b>{divertModalData.scanData.customerName}</b> uchun kamaygan miqdorga avtomatik qayta ishlab chiqarish buyrug&apos;i (Re-order) qoralamasini yaratish
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDivertModalData((prev) => ({ ...prev, open: false }))}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDivertScan}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tasdiqlash va biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
